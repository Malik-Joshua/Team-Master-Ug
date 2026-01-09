# Fix Supabase API Worker Error

## Error Message
```
{"component":"apiworker","error":"context canceled","level":"error","msg":"background apiworker is exiting","time":"2026-01-08T18:57:45Z"}
```

## What This Means

This error indicates that Supabase's background API worker (which handles tasks like sending emails) is being canceled or timing out. This could explain why confirmation emails aren't being sent for club_captain signups.

## Possible Causes

1. **SMTP Connection Timeout** - The worker is trying to send emails but the SMTP connection is timing out
2. **SMTP Credentials Issue** - Invalid SMTP credentials causing the worker to fail
3. **Rate Limiting** - Too many email requests causing the worker to be overwhelmed
4. **Supabase Infrastructure Issue** - Temporary issue with Supabase's email service
5. **Email Template Error** - Malformed email template causing the worker to crash

## Solutions

### Solution 1: Verify SMTP Settings

1. Go to Supabase Dashboard → Authentication → Settings → SMTP Settings
2. **Double-check all SMTP credentials:**
   - SMTP Host: Correct? (e.g., `smtp.gmail.com`)
   - SMTP Port: Correct? (587 for TLS, 465 for SSL)
   - SMTP User: Your email address
   - SMTP Password: App-specific password (verify it's correct)
3. **Test the connection** if Supabase provides a test button
4. **Save settings** again to ensure they're persisted

### Solution 2: Check Email Template

1. Go to Authentication → Email Templates
2. Check "Confirm signup" template
3. Ensure it's valid and contains `{{ .ConfirmationURL }}`
4. If template looks corrupted, reset it to default

### Solution 3: Check Supabase Status

1. Visit https://status.supabase.com/
2. Check if there are any ongoing issues with:
   - Email service
   - Authentication service
   - API workers

### Solution 4: Reduce Rate Limiting

If you've been testing signups repeatedly:
1. Wait 5-10 minutes before trying again
2. Use different email addresses for testing
3. Check if there's a rate limit on your Supabase plan

### Solution 5: Check Supabase Logs

1. Go to Supabase Dashboard → Logs → Auth Logs
2. Filter by the time of the error (18:57:45 on 2026-01-08)
3. Look for:
   - SMTP connection errors
   - Email sending failures
   - Template errors
   - Rate limit errors

### Solution 6: Try Different SMTP Provider

If Gmail SMTP continues to fail:
1. Try a different email provider:
   - **SendGrid** (free tier available)
   - **AWS SES** (very reliable)
   - **Mailgun** (developer-friendly)
2. Configure the new provider in Supabase SMTP settings

### Solution 7: Temporary Workaround - Disable Email Confirmation

**⚠️ Only for development/testing:**

1. Go to Authentication → Settings → Email Auth
2. Turn OFF "Confirm email"
3. Users can sign up and log in immediately
4. **Remember to turn it back ON for production!**

## Immediate Fix for Current User

While investigating the email issue, manually confirm the user:

```sql
-- Confirm the user so they can proceed
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'malikdesa51@gmail.com'
  AND email_confirmed_at IS NULL;

-- Verify
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'malikdesa51@gmail.com';
```

Then the user can log in and the club captain profile will be created automatically.

## Next Steps

1. **Check SMTP settings** - Most likely cause
2. **Review Supabase logs** - Look for specific SMTP errors
3. **Test with a different email** - See if it's email-specific
4. **Contact Supabase support** - If issue persists after checking above

## Monitoring

After fixing, monitor:
- Supabase Logs → Auth Logs for email sending success
- Browser console for signup flow
- User reports of email delivery
