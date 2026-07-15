import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

/**
 * GET /api/fixtures/[id]/squad-pdf
 *
 * Generates a professional, shareable PDF of the selected squad for a fixture —
 * starting lineup + substitutes, with jersey numbers, positions, and captain
 * markers — branded with the club's name and colours. Intended for the team
 * manager to download and share with the coach, players, and anyone concerned.
 *
 * Allowed roles: admin, data_admin, coach.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['admin', 'data_admin', 'coach'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only team managers, coaches, and admins can download squad lists' },
        { status: 403 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Match details
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('id, match_date, opponent, venue, tournament_type, notes')
      .eq('id', matchId)
      .single()

    if (!match) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
    }

    // Squad selections
    const { data: selections } = await supabaseAdmin
      .from('fixture_team_selections')
      .select('*')
      .eq('match_id', matchId)
      .order('is_starting', { ascending: false })
      .order('jersey_number', { ascending: true })

    if (!selections || selections.length === 0) {
      return NextResponse.json(
        { error: 'No squad has been selected for this fixture yet' },
        { status: 400 }
      )
    }

    // Player names
    const playerIds = selections.map((s: any) => s.player_id)
    const { data: playersData } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name')
      .in('user_id', playerIds)
    const playersMap = new Map((playersData || []).map((p: any) => [p.user_id, p.name]))
    selections.forEach((s: any) => {
      s.player_name = playersMap.get(s.player_id) || 'Unknown Player'
    })

    // Club branding — name + colours + badge (most recent row wins)
    let clubName = 'Team Master'
    let primaryColor = '#1A5276'
    let badgeUrl: string | null = null
    try {
      const { data: club } = await supabaseAdmin
        .from('club_settings')
        .select('club_nickname, primary_color, badge_url')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (club?.club_nickname) clubName = club.club_nickname
      if (club?.primary_color) primaryColor = club.primary_color
      if (club?.badge_url) badgeUrl = club.badge_url
    } catch { /* keep defaults */ }

    // Fetch the club badge and turn it into a data URL jsPDF can embed. Best
    // effort — if the badge can't be loaded we simply render the header without
    // it rather than failing the whole download.
    let badgeDataUrl: string | null = null
    let badgeFormat: 'PNG' | 'JPEG' | null = null
    if (badgeUrl) {
      try {
        const imgRes = await fetch(badgeUrl)
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || ''
          const buf = Buffer.from(await imgRes.arrayBuffer())
          // jsPDF's addImage handles PNG and JPEG; skip anything else (e.g. svg).
          if (contentType.includes('png') || badgeUrl.toLowerCase().endsWith('.png')) {
            badgeFormat = 'PNG'
          } else if (contentType.includes('jpeg') || contentType.includes('jpg') || /\.jpe?g$/i.test(badgeUrl)) {
            badgeFormat = 'JPEG'
          }
          if (badgeFormat && buf.length > 0) {
            badgeDataUrl = `data:image/${badgeFormat.toLowerCase()};base64,${buf.toString('base64')}`
          }
        }
      } catch { /* render without the badge */ }
    }

    // Convert hex → RGB for jsPDF
    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '')
      const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
      const n = parseInt(full, 16)
      if (isNaN(n)) return [26, 82, 118]
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const [pr, pg, pb] = hexToRgb(primaryColor)

    // Order each group the way a rugby team sheet reads: by shirt number, which
    // encodes the position (1-7/1-15 starters, 8-12/16-23 bench). When a shirt
    // number hasn't been assigned, fall back to canonical rugby position order
    // (forwards 1-8, then backs 9-15) so the list is still sensibly organised.
    const POSITION_ORDER = [
      'loosehead_prop', 'prop', 'hooker', 'tighthead_prop', 'lock',
      'blindside_flanker', 'openside_flanker', 'flanker', '8th_man',
      'scrum_half', 'fly_half', 'left_wing', 'winger',
      'inside_center', 'outside_center', 'right_wing', 'full_back',
    ]
    const positionRank = (pos: string | null | undefined) => {
      const idx = POSITION_ORDER.indexOf(String(pos || ''))
      return idx === -1 ? 999 : idx
    }
    const toJerseyNum = (v: any): number | null => {
      if (v == null || v === '') return null
      const n = Number(v)
      return isNaN(n) ? null : n
    }
    const bySquadOrder = (a: any, b: any) => {
      const an = toJerseyNum(a.jersey_number)
      const bn = toJerseyNum(b.jersey_number)
      if (an != null && bn != null) return an - bn      // both numbered → numeric
      if (an != null) return -1                          // numbered before un-numbered
      if (bn != null) return 1
      const pr2 = positionRank(a.position) - positionRank(b.position)
      if (pr2 !== 0) return pr2                           // else canonical position order
      return String(a.player_name || '').localeCompare(String(b.player_name || ''))
    }

    const starting = selections
      .filter((s: any) => s.is_starting && !s.is_substitute)
      .sort(bySquadOrder)
    const substitutes = selections
      .filter((s: any) => s.is_substitute)
      .sort(bySquadOrder)

    // ---- Build the PDF ----
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    let y = 0

    const fmtDate = (d: string) => {
      const date = new Date(d)
      if (isNaN(date.getTime())) return 'TBD'
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    }
    const fmtTime = (d: string) => {
      const date = new Date(d)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    const tournament = (match.tournament_type || 'Match').replace(/_/g, ' ')

    // Header band (club colour)
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, 0, pageWidth, 40, 'F')

    // Club badge (left) — on a white rounded backdrop so transparent or
    // dark-on-dark logos stay visible against the coloured band. Text shifts
    // right to make room; without a badge the layout is unchanged.
    let textX = margin
    if (badgeDataUrl && badgeFormat) {
      const size = 22
      const bx = margin
      const by = (40 - size) / 2 // vertically centre within the 40-tall band
      try {
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(bx - 2, by - 2, size + 4, size + 4, 3, 3, 'F')
        doc.addImage(badgeDataUrl, badgeFormat, bx, by, size, size)
        textX = bx + size + 8
      } catch { /* if the image fails to embed, fall back to text-only header */ }
    }

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(clubName, textX, 20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text('Match Day Squad List', textX, 30)
    // Tournament tag (right aligned)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    const tag = tournament.toUpperCase()
    doc.text(tag, pageWidth - margin - doc.getTextWidth(tag), 20)

    y = 52

    // Fixture line
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    const fixtureLine = `${clubName}  vs  ${match.opponent}`
    doc.text(fixtureLine, margin, y)
    y += 9

    // Meta rows
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(90, 90, 90)
    const time = fmtTime(match.match_date)
    doc.text(`Date:  ${fmtDate(match.match_date)}${time ? `   |   Kickoff: ${time}` : ''}`, margin, y)
    y += 6
    doc.text(`Venue:  ${match.venue || 'TBD'}`, margin, y)
    y += 6
    doc.text(`Squad size:  ${selections.length} players  (${starting.length} starting, ${substitutes.length} substitutes)`, margin, y)
    y += 8

    // Divider
    doc.setDrawColor(pr, pg, pb)
    doc.setLineWidth(0.6)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // Column layout for a player table
    const colNo = margin              // jersey #
    const colName = margin + 18       // player name
    const colPos = pageWidth - margin - 55 // position (right area)

    const checkBreak = (space = 8) => {
      if (y + space > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
    }

    const sectionHeader = (title: string, count: number) => {
      checkBreak(14)
      doc.setFillColor(pr, pg, pb)
      doc.rect(margin, y - 5, pageWidth - margin * 2, 9, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`${title}  (${count})`, margin + 3, y + 1.5)
      y += 12
      // Column captions
      doc.setTextColor(120, 120, 120)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('#', colNo, y)
      doc.text('PLAYER', colName, y)
      doc.text('POSITION', colPos, y)
      y += 2
      doc.setDrawColor(210, 210, 210)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
    }

    const playerRow = (s: any, displayNum: number) => {
      checkBreak(9)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)
      // Sequential team-sheet number: starters run 1..N, the bench continues
      // straight on (e.g. Sevens 1-7 then 8-12; Fifteens 1-15 then 16-23), so
      // the sheet always reads as a clean running order regardless of the
      // individual shirt numbers stored against each player.
      doc.setFont('helvetica', 'bold')
      doc.text(String(displayNum), colNo, y)
      // Name (+ captain markers)
      doc.setFont('helvetica', 'normal')
      let name = s.player_name || 'Unknown Player'
      if (s.is_captain) name += '  (C)'
      else if (s.is_assistant_captain) name += '  (VC)'
      doc.text(name, colName, y)
      // Position (prettify: fly_half -> Fly Half)
      doc.setTextColor(90, 90, 90)
      doc.setFontSize(10)
      const prettyPos = s.position
        ? String(s.position).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : '-'
      doc.text(prettyPos, colPos, y)
      y += 7
      doc.setDrawColor(235, 235, 235)
      doc.setLineWidth(0.2)
      doc.line(margin, y - 2.5, pageWidth - margin, y - 2.5)
    }

    // Starting lineup — numbered 1..N
    sectionHeader('Starting Lineup', starting.length)
    if (starting.length === 0) {
      doc.setFont('helvetica', 'italic'); doc.setTextColor(140, 140, 140); doc.setFontSize(10)
      doc.text('No starting players recorded.', colName, y); y += 7
    } else {
      starting.forEach((s: any, i: number) => playerRow(s, i + 1))
    }
    y += 6

    // Substitutes — numbering continues from the end of the starting lineup
    sectionHeader('Substitutes', substitutes.length)
    if (substitutes.length === 0) {
      doc.setFont('helvetica', 'italic'); doc.setTextColor(140, 140, 140); doc.setFontSize(10)
      doc.text('No substitutes recorded.', colName, y); y += 7
    } else {
      substitutes.forEach((s: any, i: number) => playerRow(s, starting.length + i + 1))
    }

    // Match notes (if any)
    if (match.notes) {
      y += 8
      checkBreak(20)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb); doc.setFontSize(11)
      doc.text('Match Day Notes', margin, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70); doc.setFontSize(10)
      const wrapped = doc.splitTextToSize(match.notes, pageWidth - margin * 2)
      wrapped.forEach((line: string) => { checkBreak(6); doc.text(line, margin, y); y += 5 })
    }

    // Captain legend
    y += 8
    checkBreak(8)
    doc.setFont('helvetica', 'italic'); doc.setTextColor(130, 130, 130); doc.setFontSize(9)
    doc.text('(C) Captain    (VC) Vice / Assistant Captain', margin, y)

    // Footer on every page
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.setFontSize(8)
      const footer = `${clubName} — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
      doc.text(footer, margin, pageHeight - 9)
      const pageLabel = `Page ${i} of ${pageCount}`
      doc.text(pageLabel, pageWidth - margin - doc.getTextWidth(pageLabel), pageHeight - 9)
    }

    const safeOpponent = String(match.opponent || 'opponent').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const fileName = `squad-${safeOpponent}-${match.match_date?.split('T')[0] || 'fixture'}.pdf`
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Squad PDF generation error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
