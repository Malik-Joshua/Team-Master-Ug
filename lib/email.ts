import { Resend } from 'resend'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Transactional email — currently just the "your account was created"
 * welcome email fired when a manager/admin adds a player or staff member
 * (one-off manual add, onboarding CSV import, or the staff invite form).
 *
 * Two providers, tried in order:
 *   1. Resend — preferred, but it will ONLY deliver to arbitrary recipients
 *      once you've verified a sending domain; before that it silently limits
 *      delivery to the account owner's own address. Free tier 3,000/mo.
 *   2. Gmail SMTP (via nodemailer) — fallback for when there's no verified
 *      Resend domain yet. Sends from a normal Gmail account using an App
 *      Password, reaching ANY recipient immediately with no DNS setup
 *      (~500/day limit). See SETUP_GMAIL_EMAIL.md.
 *
 * Design goals:
 *   - Never throw. A missing/invalid key or a provider outage should
 *     degrade to "account created, no email sent" — never block account
 *     creation, which is the actual thing the manager is waiting on.
 *   - Callers get back { sent: boolean, error?: string, via?: string } so
 *     the API route can decide whether to still show the temp password in
 *     the response (fallback for when the email didn't go out).
 */

// Constructed lazily (not at module load) so a missing key doesn't crash
// the route in dev/CI before anyone's tried to send anything.
function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

// Must be a domain verified in the Resend dashboard. Defaults to Resend's
// own sandbox sender so local/dev testing works without any DNS setup —
// swap to a verified club domain (e.g. "TeamMaster <noreply@yourclub.app>")
// before going live, or Resend will reject sends to anyone but the account
// owner's own verified email.
const FROM = process.env.RESEND_FROM_EMAIL || 'TeamMaster <onboarding@resend.dev>'

// Gmail SMTP fallback. GMAIL_USER is the full address (you@gmail.com);
// GMAIL_APP_PASSWORD is a 16-char Google App Password (NOT the normal
// account password — requires 2-Step Verification enabled on the account).
// Both must be present for the fallback to be used.
function getGmailTransport(): Transporter | null {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  // Explicit 587/STARTTLS over IPv4 rather than the `service: 'gmail'`
  // shorthand, which defaults to port 465 (implicit SSL). 465 was observed
  // timing out / IPv6-unreachable in some environments while 587 connected
  // reliably — 587 is the more firewall-friendly of Gmail's two ports.
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4, // force IPv4 — IPv6 route to Gmail was unreachable in some envs
    connectionTimeout: 15000,
    auth: { user, pass: pass.replace(/\s+/g, '') }, // App Passwords display with spaces; strip them
  } as Parameters<typeof nodemailer.createTransport>[0])
}

// True when a real verified Resend domain is configured, i.e. Resend can
// deliver to arbitrary recipients. We treat a missing RESEND_FROM_EMAIL, or
// the sandbox onboarding@resend.dev sender, as "not domain-verified" — so the
// Gmail fallback is used to reach real players/staff instead of silently
// failing to deliver to anyone but the Resend account owner.
function resendCanReachAnyone(): boolean {
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  if (!from) return false
  return !/@resend\.dev>?\s*$/i.test(from)
}

export interface WelcomeEmailParams {
  to: string
  name: string
  role: string
  tempPassword: string
  clubName?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  player: 'Player',
  coach: 'Coach',
  admin: 'Owner / Admin',
  data_admin: 'Team Manager',
  finance_admin: 'Finance Admin',
  physio: 'Physiotherapist',
  club_captain: 'Club Captain',
  asst_coach: 'Assistant Coach',
  analyst: 'Analyst',
}

interface EmailContent {
  subject: string
  html: string
  text: string
}

// Builds the shared welcome-email content so both providers send an
// identical message.
function buildWelcomeContent(params: WelcomeEmailParams): EmailContent {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/welcome?email=${encodeURIComponent(params.to)}`
  const roleLabel = ROLE_LABEL[params.role] || 'Team Member'
  const club = params.clubName?.trim() || 'your club'

  const subject = `Welcome to ${params.clubName?.trim() || 'TeamMaster'} — your account is ready`

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <div style="background: #111827; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🏉 Team Master</h1>
    </div>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px 28px;">
      <p style="font-size: 15px; margin: 0 0 16px;">Hi ${escapeHtml(params.name)},</p>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 20px;">
        You've been added to <strong>${escapeHtml(club)}</strong> on Team Master as a <strong>${roleLabel}</strong>.
        Use the details below to activate your account — you&apos;ll choose your own password.
      </p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 18px; margin: 0 0 24px;">
        <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Email</p>
        <p style="margin: 0 0 14px; font-size: 15px; font-weight: 600;">${escapeHtml(params.to)}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Temporary password</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; font-family: monospace;">${escapeHtml(params.tempPassword)}</p>
      </div>
      <a href="${loginUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px;">
        Activate my account
      </a>
      <p style="font-size: 13px; color: #6b7280; margin: 24px 0 0; line-height: 1.5;">
        The temporary password is only there to get you in — you&apos;ll be asked to create your own
        password straight away, and you can change it any time from your Profile page. If you weren&apos;t expecting this email, you can
        safely ignore it.
      </p>
    </div>
  </div>`

  const text = `Hi ${params.name},

You've been added to ${club} on Team Master as a ${roleLabel}.

Email: ${params.to}
Temporary password: ${params.tempPassword}

Activate your account (you'll choose your own password; you can change it later from your Profile page): ${loginUrl}`

  return { subject, html, text }
}

async function sendViaResend(to: string, content: EmailContent): Promise<{ sent: boolean; error?: string }> {
  const client = getResendClient()
  if (!client) return { sent: false, error: 'RESEND_API_KEY is not configured' }
  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    })
    if (error) {
      console.error('[email] Resend send failed:', error)
      return { sent: false, error: error.message || 'Resend rejected the send' }
    }
    return { sent: true }
  } catch (err: any) {
    console.error('[email] Unexpected error sending via Resend:', err)
    return { sent: false, error: err?.message || 'Unexpected error sending via Resend' }
  }
}

async function sendViaGmail(to: string, content: EmailContent): Promise<{ sent: boolean; error?: string }> {
  const transport = getGmailTransport()
  if (!transport) return { sent: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD not configured' }
  const fromName = process.env.RESEND_FROM_EMAIL?.split('<')[0]?.trim() || 'Team Master'
  try {
    await transport.sendMail({
      from: `${fromName} <${process.env.GMAIL_USER}>`,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    })
    return { sent: true }
  } catch (err: any) {
    console.error('[email] Gmail SMTP send failed:', err)
    return { sent: false, error: err?.message || 'Gmail SMTP rejected the send' }
  }
}

/**
 * Sends the "your TeamMaster account is ready" email with a login link and
 * temporary password.
 *
 * Provider order is chosen so a real recipient actually receives it:
 *   - If Resend has a verified domain, prefer Resend, fall back to Gmail.
 *   - Otherwise (Resend on sandbox or unconfigured) prefer Gmail — the
 *     Resend sandbox can only reach the account owner, so it would silently
 *     fail to deliver to real players/staff.
 *
 * Returns { sent, error?, via? } instead of throwing on any failure — see
 * file header for why.
 */
export async function sendWelcomeEmail(
  params: WelcomeEmailParams
): Promise<{ sent: boolean; error?: string; via?: string }> {
  const content = buildWelcomeContent(params)

  const gmailAvailable = !!getGmailTransport()
  const resendAvailable = !!getResendClient()

  // Compact, value-free config snapshot. Surfaced in the error when nothing
  // sends so it's obvious (from the on-screen message / logs) whether the
  // running deployment actually received each env var — the usual cause of
  // "email won't send in prod but works locally" is a missing/unscoped var.
  const diag =
    `[config: RESEND_API_KEY=${!!process.env.RESEND_API_KEY}, ` +
    `RESEND_FROM_EMAIL=${process.env.RESEND_FROM_EMAIL ? 'set' : 'unset'}, ` +
    `GMAIL_USER=${!!process.env.GMAIL_USER}, ` +
    `GMAIL_APP_PASSWORD=${!!process.env.GMAIL_APP_PASSWORD}]`

  // Build the attempt order.
  const providers: { name: string; run: () => Promise<{ sent: boolean; error?: string }> }[] = []
  if (resendCanReachAnyone() && resendAvailable) {
    providers.push({ name: 'resend', run: () => sendViaResend(params.to, content) })
    if (gmailAvailable) providers.push({ name: 'gmail', run: () => sendViaGmail(params.to, content) })
  } else {
    if (gmailAvailable) providers.push({ name: 'gmail', run: () => sendViaGmail(params.to, content) })
    if (resendAvailable) providers.push({ name: 'resend', run: () => sendViaResend(params.to, content) })
  }

  if (providers.length === 0) {
    return { sent: false, error: `No email provider configured. ${diag}` }
  }

  const errors: string[] = []
  for (const provider of providers) {
    const result = await provider.run()
    if (result.sent) return { sent: true, via: provider.name }
    errors.push(`${provider.name}: ${result.error}`)
  }

  // Note when a provider was skipped entirely because it wasn't configured —
  // e.g. Gmail creds missing in prod means only 'resend:' shows up here.
  if (!gmailAvailable) errors.push('gmail: skipped (GMAIL_USER/GMAIL_APP_PASSWORD not seen by this deployment)')

  return { sent: false, error: `${errors.join(' | ')} ${diag}` }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
