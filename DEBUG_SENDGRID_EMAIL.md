# Debug SendGrid Email Not Sending

## Step-by-Step Verification

### 1. Verify SendGrid Configuration in Supabase

Go to Supabase Dashboard → Authentication → Settings → SMTP Settings and verify:

- [ ] **Custom SMTP** is **enabled** (toggle is ON)
- [ ] **SMTP Host:** `smtp.sendgrid.net` (exactly this, no typos)
- [ ] **SMTP Port:** `587` (not 465, not 25)
- [ ] **SMTP User:** `apikey` (literally the word "apikey", all lowercase)
- [ ] **SMTP Password:** Your SendGrid API key (starts with `SG.`)
- [ ] **Sender Email:** Your verified email in SendGrid
- [ ] **Sender Name:** Something like "TeamMaster" (not empty)

**Common Mistakes:**
- ❌ SMTP User is your email instead of "apikey"
- ❌ SMTP Password is wrong (not the API key)
- ❌ Wrong port number
- ❌ Custom SMTP toggle is OFF

### 2. Verify SendGrid Sender Authentication

1. **Go to SendGrid Dashboard** → Settings → Sender Authentication
2. **Check if sender is verified:**
   - Should show "Verified" status
   - If not verified, click "Verify a Single Sender" and complete verification
3. **Important:** The sender email in Supabase must match the verified email in SendGrid

### 3. Check SendGrid API Key Permissions

1. **Go to SendGrid Dashboard** → Settings → API Keys
2. **Find your API key** (the one you're using in Supabase)
3. **Verify permissions:**
   - Should have "Mail Send" permission
   - If "Full Access", that's fine too
4. **If key doesn't have Mail Send permission:**
   - Create a new API key with Mail Send permission
   - Update Supabase with the new key

### 4. Check SendGrid Activity

1. **Go to SendGrid Dashboard** → Activity
2. **Look for:**
   - Email sending attempts
   - Bounce/delivery errors
   - Authentication failures
3. **If you see errors:**
   - Click on the error to see details
   - Common errors:
     - "Authentication failed" → Wrong API key or SMTP user
     - "Sender not verified" → Need to verify sender
     - "Rate limit exceeded" → Too many emails (unlikely on free tier)

### 5. Check Supabase Logs

1. **Go to Supabase Dashboard** → Logs → Auth Logs
2. **Filter by:**
   - Time of signup attempt
   - Email address
3. **Look for:**
   - SMTP connection errors
   - Authentication failures
   - Email sending errors
   - Specific error messages

### 6. Test SendGrid SMTP Connection

**Option A: Use Supabase Test (if available)**
- Some Supabase versions have a "Test Email" button in SMTP settings
- Click it and check if test email arrives

**Option B: Test via Command Line**
```bash
# Test SMTP connection (replace with your values)
telnet smtp.sendgrid.net 587
```

**Option C: Check SendGrid Stats**
- Go to SendGrid Dashboard → Stats
- See if any emails are being sent
- If zero, emails aren't reaching SendGrid

### 7. Verify Email Template in Supabase

1. **Go to Authentication → Email Templates**
2. **Check "Confirm signup" template:**
   - Must contain: `{{ .ConfirmationURL }}`
   - Should be valid HTML/text
   - Not empty
3. **If template is missing or corrupted:**
   - Reset to default
   - Ensure `{{ .ConfirmationURL }}` is present

### 8. Check Browser Console

When signing up, check browser console (F12) for:
- Any errors from `supabase.auth.signUp()`
- The logged messages we added
- Network errors

### 9. Common SendGrid Issues

#### Issue: "Authentication failed"
**Fix:**
- Verify SMTP User is exactly `apikey` (lowercase)
- Verify SMTP Password is the full API key (starts with `SG.`)
- Check API key hasn't been revoked in SendGrid

#### Issue: "Sender not verified"
**Fix:**
- Go to SendGrid → Sender Authentication
- Verify the sender email
- Ensure Supabase sender email matches verified email

#### Issue: "Rate limit exceeded"
**Fix:**
- Free tier: 100 emails/day
- Check SendGrid dashboard for usage
- Wait until next day or upgrade plan

#### Issue: Emails sent but not received
**Fix:**
- Check spam folder
- Check SendGrid Activity for delivery status
- Verify recipient email is valid

### 10. Double-Check SMTP Settings Format

**Correct Format:**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Sender Email: your-verified-email@example.com
Sender Name: TeamMaster
```

**Wrong Formats:**
```
❌ SMTP User: your-email@example.com (should be "apikey")
❌ SMTP Password: your-password (should be API key)
❌ SMTP Port: 465 (use 587 for TLS)
❌ SMTP Host: sendgrid.net (missing "smtp.")
```

## Quick Test

Try this SQL to manually check if users are being created:

```sql
-- Check recent signups
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ Not Confirmed - Email Not Sent'
    ELSE '✅ Confirmed'
  END as status
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

If users are being created but `email_confirmed_at` is NULL, emails aren't being sent.

## Still Not Working?

1. **Check SendGrid Activity Feed** - Most important!
   - See if emails are reaching SendGrid
   - See specific error messages

2. **Try a Different Email Provider:**
   - AWS SES (more reliable)
   - Mailgun (easier setup)

3. **Contact Supabase Support:**
   - Share the error from Auth Logs
   - They can check server-side SMTP connection

4. **Temporary Workaround:**
   - Disable email confirmation temporarily
   - Manually confirm users via SQL
   - Fix email later
