import { Resend } from 'resend'

/**
 * Transactional email — currently just the "your account was created"
 * welcome email fired when a manager/admin adds a player or staff member
 * (one-off manual add, onboarding CSV import, or the staff invite form).
 *
 * Provider: Resend. Free tier (3,000/mo, 100/day) comfortably covers a
 * single club's onboarding + roster-churn volume.
 *
 * Design goals:
 *   - Never throw. A missing/invalid API key or a Resend outage should
 *     degrade to "account created, no email sent" — never block account
 *     creation, which is the actual thing the manager is waiting on.
 *   - Callers get back a simple { sent: boolean, error?: string } so the
 *     API route can decide whether to still show the temp password in
 *     the response (fallback for when the email didn't go out).
 */

// Constructed lazily (not at module load) so a missing key doesn't crash
// the route in dev/CI before anyone's tried to send anything.
function getClient(): Resend | null {
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

/**
 * Sends the "your TeamMaster account is ready" email with a login link and
 * temporary password. Returns { sent: false, error } instead of throwing on
 * any failure — see file header for why.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<{ sent: boolean; error?: string }> {
  const client = getClient()
  if (!client) {
    return { sent: false, error: 'RESEND_API_KEY is not configured — email not sent.' }
  }

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`
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
        Use the details below to sign in for the first time.
      </p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 18px; margin: 0 0 24px;">
        <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Email</p>
        <p style="margin: 0 0 14px; font-size: 15px; font-weight: 600;">${escapeHtml(params.to)}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Temporary password</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; font-family: monospace;">${escapeHtml(params.tempPassword)}</p>
      </div>
      <a href="${loginUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px;">
        Sign in to Team Master
      </a>
      <p style="font-size: 13px; color: #6b7280; margin: 24px 0 0; line-height: 1.5;">
        For your security, please change this password after your first sign-in
        (Settings → Account). If you weren't expecting this email, you can
        safely ignore it.
      </p>
    </div>
  </div>`

  const text = `Hi ${params.name},

You've been added to ${club} on Team Master as a ${roleLabel}.

Email: ${params.to}
Temporary password: ${params.tempPassword}

Sign in: ${loginUrl}

Please change your password after your first sign-in (Settings → Account).`

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to: params.to,
      subject,
      html,
      text,
    })
    if (error) {
      console.error('[email] Resend send failed:', error)
      return { sent: false, error: error.message || 'Resend rejected the send' }
    }
    return { sent: true }
  } catch (err: any) {
    console.error('[email] Unexpected error sending welcome email:', err)
    return { sent: false, error: err?.message || 'Unexpected error sending email' }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
