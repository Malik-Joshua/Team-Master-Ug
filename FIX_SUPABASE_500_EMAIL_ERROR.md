# Fix Supabase 500 Error - Email Sending Failure

## Error Details
```
POST https://jktmzzbdzprlztabrmgb.supabase.co/auth/v1/signup?redirect_to=... 500 (Internal Server Error)
Error sending confirmation email
```

## What This Means

This is a **500 Internal Server Error** from Supabase's authentication service. It means Supabase is trying to send the confirmation email but failing on their server side. This is **NOT** a code issue - it's a Supabase email configuration problem.

## Root Causes

1. **SMTP Configuration Issue** - Most common
   - Wrong SMTP credentials
   - SMTP connection timeout
   - Invalid SMTP settings

2. **Email Template Problem**
   - Malformed email template
   - Missing required template variables

3. **Supabase Service Issue**
   - Temporary Supabase email service outage
   - Rate limiting

## ⚠️ Important: Gmail SMTP Warning

If you see: *"SMTP provider is designed for personal rather than transactional email"*

**This means Gmail SMTP is not suitable for production.** Use a transactional email service instead:
- **SendGrid** (Recommended - Free tier: 100 emails/day)
- **AWS SES** (Best for production - Very cheap)
- **Mailgun** (Developer-friendly)

See `SETUP_TRANSACTIONAL_EMAIL.md` for detailed setup instructions.

## Solutions

### Solution 1: Switch to Transactional Email Service (Recommended)

**Gmail SMTP causes:**
- Rate limiting (only ~100 emails/day)
- Poor deliverability
- Emails marked as spam
- Account restrictions

**Use SendGrid instead:**
1. Sign up at https://sendgrid.com (free)
2. Create API key
3. Configure in Supabase:
   - SMTP Host: `smtp.sendgrid.net`
   - SMTP Port: `587`
   - SMTP User: `apikey`
   - SMTP Password: Your SendGrid API key

See `SETUP_TRANSACTIONAL_EMAIL.md` for complete instructions.

### Solution 2: Fix Gmail SMTP Settings (Temporary)

1. **Go to Supabase Dashboard** → Authentication → Settings → SMTP Settings

2. **Verify ALL settings:**
   - ✅ "Custom SMTP" is **enabled**
   - ✅ SMTP Host: `smtp.gmail.com` (or your provider)
   - ✅ SMTP Port: `587` (TLS) or `465` (SSL)
   - ✅ SMTP User: Your full email address
   - ✅ SMTP Password: **App-specific password** (16 characters, no spaces)
   - ✅ Sender Email: Your email address
   - ✅ Sender Name: Your app name

3. **Common SMTP Mistakes:**
   - ❌ Using regular Gmail password instead of app-specific password
   - ❌ Wrong port number
   - ❌ Wrong SMTP host
   - ❌ Missing sender email/name

4. **Save settings** and try again

### Solution 2: Test SMTP Connection

1. **Check if Supabase has a "Test Email" button:**
   - Look in SMTP Settings
   - Click "Test" or "Send Test Email"
   - Check if test email arrives

2. **If test fails:**
   - Double-check all SMTP credentials
   - Try a different email provider
   - Check Gmail account activity for blocked attempts

### Solution 3: Check Email Template

1. **Go to Authentication → Email Templates**
2. **Check "Confirm signup" template:**
   - Must contain: `{{ .ConfirmationURL }}`
   - Must be valid HTML/text
   - Should not be empty

3. **Reset template if corrupted:**
   - Use default template
   - Add only `{{ .ConfirmationURL }}` if customizing

### Solution 4: Check Supabase Logs

1. **Go to Logs → Auth Logs**
2. **Look for:**
   - SMTP connection errors
   - Email sending failures
   - Template errors
   - Rate limit errors

3. **Filter by time** of the error to see exact failure reason

### Solution 5: Try Different Email Provider

If Gmail SMTP continues to fail:

**Option A: SendGrid (Recommended)**
1. Sign up at sendgrid.com (free tier available)
2. Create API key
3. Configure in Supabase:
   - SMTP Host: `smtp.sendgrid.net`
   - SMTP Port: `587`
   - SMTP User: `apikey`
   - SMTP Password: Your SendGrid API key

**Option B: AWS SES**
- More reliable for production
- Requires AWS account setup
- Better deliverability

### Solution 6: Temporary Workaround - Disable Email Confirmation

**⚠️ Development/Testing Only:**

1. Go to Authentication → Settings → Email Auth
2. Turn OFF "Confirm email"
3. Users can sign up and log in immediately
4. **Turn back ON for production!**

## Immediate Fix for Current Users

While fixing SMTP, manually confirm users:

```sql
-- Find unconfirmed users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email_confirmed_at IS NULL
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Manually confirm a specific user
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'user@example.com'
  AND email_confirmed_at IS NULL;

-- Verify
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'user@example.com';
```

After confirming, users can log in and profiles will be created automatically.

## Verification Steps

After fixing SMTP:

1. **Test signup** with a new email
2. **Check browser console** - should see success, not 500 error
3. **Check email inbox** - confirmation email should arrive
4. **Check Supabase Logs** - should see successful email sending

## Common SMTP Configuration Errors

### Gmail App-Specific Password
- ❌ Wrong: Your regular Gmail password
- ✅ Correct: 16-character app-specific password from Google Account

### SMTP Port
- ❌ Wrong: Port 25 (often blocked)
- ✅ Correct: Port 587 (TLS) or 465 (SSL)

### SMTP Host
- ❌ Wrong: `smtp.google.com` or `mail.gmail.com`
- ✅ Correct: `smtp.gmail.com`

## Next Steps

1. **Double-check SMTP credentials** - This fixes 90% of cases
2. **Test SMTP connection** - Verify credentials work
3. **Check Supabase logs** - See exact error message
4. **Contact Supabase support** - If issue persists after checking above
