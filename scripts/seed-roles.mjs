// One-time dev seed: create a test account per role so dev-bypass login works for each.
// Usage: node scripts/seed-roles.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE env vars in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const PREFIX = { player: 'PLR', coach: 'COA', admin: 'ADM', data_admin: 'TMA', finance_admin: 'FNA', physio: 'PHY', club_captain: 'CAP' }

const accounts = [
  { role: 'coach',         name: 'Coach Carter',     email: 'coach@teammaster.dev' },
  { role: 'player',        name: 'Pat Player',       email: 'player@teammaster.dev', position: 'fly_half', category: 'backs', jersey_number: 10 },
  { role: 'physio',        name: 'Phoebe Physio',    email: 'physio@teammaster.dev' },
  { role: 'club_captain',  name: 'Cam Captain',      email: 'captain@teammaster.dev' },
  { role: 'finance_admin', name: 'Fiona Finance',    email: 'finance@teammaster.dev' },
  { role: 'data_admin',    name: 'Tim Manager',      email: 'manager@teammaster.dev' },
]

const PASSWORD = 'password123'

async function findUserByEmail(email) {
  // listUsers is paginated; scan a couple pages
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

for (const acc of accounts) {
  try {
    // 1) auth user (reuse if exists)
    let user = await findUserByEmail(acc.email)
    if (user) {
      await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true })
      console.log(`• ${acc.role}: auth user exists (${acc.email}) — password reset`)
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: acc.email, password: PASSWORD, email_confirm: true })
      if (error) throw error
      user = data.user
      console.log(`✓ ${acc.role}: created auth user (${acc.email})`)
    }

    // 2) user_profiles (upsert by user_id)
    const { data: existingProfile } = await admin.from('user_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (!existingProfile) {
      const uniqueId = `${PREFIX[acc.role] || 'USR'}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const { error: pErr } = await admin.from('user_profiles').insert({
        user_id: user.id, unique_id: uniqueId, name: acc.name, email: acc.email, phone: null, role: acc.role, status: 'active',
      })
      if (pErr) throw pErr
      console.log(`  ↳ profile created (role=${acc.role})`)
    } else {
      console.log(`  ↳ profile already exists`)
    }

    // 3) players row for player
    if (acc.role === 'player') {
      const { data: existingPlayer } = await admin.from('players').select('id').eq('user_id', user.id).maybeSingle()
      if (!existingPlayer) {
        const { error: plErr } = await admin.from('players').insert({
          user_id: user.id, position: acc.position, category: acc.category, jersey_number: acc.jersey_number,
        })
        if (plErr) console.log(`  ↳ players insert warning: ${plErr.message}`)
        else console.log(`  ↳ players row created`)
      }
    }
  } catch (e) {
    console.error(`✗ ${acc.role} (${acc.email}): ${e.message}`)
  }
}

console.log('\nDone. Dev-bypass login should now work for all roles.')
