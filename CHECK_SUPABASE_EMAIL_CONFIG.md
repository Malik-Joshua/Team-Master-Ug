# Check Supabase Email Configuration

## Critical Settings to Verify

### 1. Authentication → Settings → Email Auth
- [ ] "Enable Email Signup" is **ON**
- [ ] "Confirm email" is **ON** (this is required for emails to be sent)
- [ ] "Secure email change" is ON (optional but recommended)

### 2. Authentication → Settings → SMTP Settings
- [ ] "Custom SMTP" is **enabled**
- [ ] SMTP Host is correct (e.g., `smtp.gmail.com`)
- [ ] SMTP Port is correct (e.g., `587` or `465`)
- [ ] SMTP User is your email address
- [ ] SMTP Password is the app-specific password (not regular password)
- [ ] Sender Email is set
- [ ] Sender Name is set

### 3. Authentication → URL Configuration
- [ ] "Site URL" is set to your production domain
  - Example: `https://team-master-gdrmv27of-team-master-ug.vercel.app`
- [ ] "Redirect URLs" includes your domain
  - Add: `https://your-domain.vercel.app/dashboard`
  - Add: `https://your-domain.vercel.app/**` (wildcard for all paths)

### 4. Authentication → Email Templates
- [ ] "Confirm signup" template exists
- [ ] Template contains: `{{ .ConfirmationURL }}`
- [ ] Template is not empty

## Test Steps

1. **Check Supabase Logs:**
   - Go to Logs → Auth Logs
   - Look for entries when club_captain signs up
   - Check for email sending errors

2. **Test with Browser Console:**
   - Open browser console (F12)
   - Try signing up as club_captain
   - Look for the logged messages:
     - "Signup - Email redirect URL: ..."
     - "Auth user created: ..."
     - "✅ Email confirmation required - email should have been sent"

3. **Check Email Provider:**
   - If using Gmail, check Gmail account activity
   - Look for blocked login attempts
   - Verify app-specific password is correct

4. **Test SMTP Connection:**
   - Some email providers have a "Test" button
   - Or send a test email from Supabase if available

## Common Fixes

### Fix 1: Add Redirect URL
If redirect URL is not in allowed list:
1. Go to Authentication → URL Configuration
2. Add your domain to "Redirect URLs"
3. Format: `https://your-domain.com/dashboard`

### Fix 2: Verify Site URL
1. Go to Authentication → URL Configuration
2. Set "Site URL" to your production domain
3. Must match the domain in your redirect URL

### Fix 3: Re-check SMTP Settings
1. Double-check SMTP password (app-specific password, not regular password)
2. Verify SMTP host and port
3. Test with a different email provider if Gmail isn't working

### Fix 4: Check Email Template
1. Go to Authentication → Email Templates
2. Edit "Confirm signup" template
3. Ensure it has: `{{ .ConfirmationURL }}`
4. Save template

## Quick SQL Check

Run this to see if users are being created but not confirmed:

```sql
-- Check recent signups
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ Not Confirmed'
    ELSE '✅ Confirmed'
  END as status
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## If Still Not Working

1. **Manually confirm the user:**
```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'malikdesa51@gmail.com';
```

2. **Check Supabase Status Page:**
   - https://status.supabase.com/
   - See if there are any email service issues

3. **Contact Supabase Support:**
   - If SMTP is configured correctly but emails still not sending
   - They can check server-side logs
