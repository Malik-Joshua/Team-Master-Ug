# Diagnose Email Not Sending for Club Captain Signups

## Quick Checks

### 1. Verify Supabase Email Configuration

Go to Supabase Dashboard → Authentication → Settings and check:

- ✅ **Email Auth** → "Enable Email Signup" is ON
- ✅ **Email Auth** → "Confirm email" is ON
- ✅ **SMTP Settings** → "Custom SMTP" is enabled
- ✅ **SMTP Settings** → All fields are filled correctly
- ✅ **URL Configuration** → "Site URL" is set to your production domain
- ✅ **URL Configuration** → Redirect URLs include your domain

### 2. Check Email Redirect URL

The signup code uses:
```javascript
const redirectUrl = `${window.location.origin}/dashboard`
```

**Make sure this URL is in your Supabase allowed redirect URLs:**
- Go to Authentication → URL Configuration
- Add your domain to "Redirect URLs" if not already there
- Example: `https://your-app.vercel.app/dashboard`

### 3. Check Supabase Auth Logs

1. Go to Supabase Dashboard → Logs → Auth Logs
2. Filter by the email address that's trying to sign up
3. Look for:
   - Email sending errors
   - SMTP connection errors
   - Template errors

### 4. Test Email Template

1. Go to Authentication → Email Templates
2. Check "Confirm signup" template
3. Ensure it contains: `{{ .ConfirmationURL }}`
4. Test the template if possible

### 5. Check Browser Console

When signing up as club_captain, check browser console for:
- Any errors from `supabase.auth.signUp()`
- The logged "Auth user created" message
- Any API errors

### 6. Verify SMTP Connection

Test your SMTP settings:
1. Go to Authentication → Settings → SMTP Settings
2. Click "Test Email" or "Send Test Email" if available
3. Check if test email arrives

### 7. Common Issues

**Issue: Email Redirect URL not allowed**
- **Fix**: Add your domain to Redirect URLs in Supabase

**Issue: Site URL not set**
- **Fix**: Set Site URL to your production domain

**Issue: SMTP credentials wrong**
- **Fix**: Double-check SMTP settings, especially the app-specific password

**Issue: Email going to spam**
- **Fix**: Check spam folder, configure SPF/DKIM records

**Issue: Rate limiting**
- **Fix**: Wait a few minutes between signups, or use a different email provider

## Manual Workaround

If emails still aren't sending, manually confirm the user:

```sql
-- Find the user
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'malikdesa51@gmail.com';

-- Confirm the user
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'malikdesa51@gmail.com'
  AND email_confirmed_at IS NULL;
```

Then the user can log in and the profile will be created automatically.
