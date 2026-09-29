# Setup: Gmail as the email sender (no domain needed)

Use this to get welcome emails reaching **real players and staff today**,
without waiting for a domain to verify in Resend.

The app tries providers in order:

1. **Resend** — but only once you've verified a sending domain. On the
   sandbox sender (`onboarding@resend.dev`) it can only deliver to your own
   Resend account email, so it's no good for real users yet.
2. **Gmail SMTP** — sends from a normal Gmail account and reaches **anyone**
   immediately. This is what these steps set up.

When Gmail is configured and Resend has no verified domain, the app
automatically prefers Gmail. Later, when your Resend domain verifies and you
set `RESEND_FROM_EMAIL` to a real address, it switches back to Resend on its
own — no code change.

---

## Step 1 — Pick/create a Gmail account

Use a dedicated account if you can (e.g. `stanbicblackpirates@gmail.com`) so
the club's outgoing mail is separate from a personal inbox. A normal free
Gmail works fine.

## Step 2 — Turn on 2-Step Verification

App Passwords only exist once 2-Step Verification is on.

1. Go to <https://myaccount.google.com/security>
2. Under **How you sign in to Google**, click **2-Step Verification**
3. Follow the prompts to switch it on (needs a phone number)

## Step 3 — Create an App Password

1. Go to <https://myaccount.google.com/apppasswords>
   (or Security → 2-Step Verification → **App passwords** at the bottom)
2. App name: type `TeamMaster` → **Create**
3. Google shows a **16-character password** in 4 blocks like `abcd efgh ijkl mnop`.
   Copy it. (You only see it once.)

## Step 4 — Add the two variables

### Local (`.env.local`)
```
GMAIL_USER=stanbicblackpirates@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```
The spaces in the app password are fine — the app strips them automatically.

### Vercel (production)
Project → **Settings → Environment Variables**, add both `GMAIL_USER` and
`GMAIL_APP_PASSWORD` (Production, and Preview if you want), then **redeploy**.

## Step 5 — Test it

Restart `npm run dev`, then add a player from the **Players** screen using
any real email address you can check. The welcome email should arrive from
your Gmail address within a minute.

The API response includes `via: "gmail"` when Gmail did the sending.

---

## Notes & limits

- **~500 emails/day** on free Gmail (2,000/day on Google Workspace). Plenty
  for onboarding one club.
- The "from" address is your Gmail address. To send from a branded club
  address instead, finish verifying a domain in Resend and set
  `RESEND_FROM_EMAIL` — the app switches back to Resend automatically.
- Occasionally a first email lands in spam; mark it "not spam" once and
  Gmail learns.
- **Never commit the App Password.** It lives only in `.env.local` (already
  gitignored) and in Vercel's env settings.
- To revoke access later, delete the App Password at
  <https://myaccount.google.com/apppasswords>.
