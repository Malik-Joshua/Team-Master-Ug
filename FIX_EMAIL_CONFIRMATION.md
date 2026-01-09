# Fix Email Confirmation Not Sending

## Problem
Users are not receiving email confirmation emails after signing up, preventing them from completing registration.

## Solutions

### Option 1: Configure Email in Supabase (Recommended for Production)

1. **Go to Supabase Dashboard** → Your Project → Authentication → Settings

2. **Check Email Settings:**
   - Scroll to "Email Auth" section
   - Ensure "Enable Email Signup" is ON
   - Ensure "Confirm email" is ON (this requires email confirmation)

3. **Configure Email Provider:**
   
   **Option A: Use Supabase's Built-in Email (Limited - Development Only)**
   - Supabase provides a basic email service for development
   - Go to Authentication → Email Templates
   - Check if templates are configured
   - Note: This has rate limits and may not work reliably

   **Option B: Configure Custom SMTP (Recommended for Production)**
   - Go to Authentication → Settings → SMTP Settings
   - Enable "Custom SMTP"
   - Configure with your email provider:
     - **Gmail**: 
       - SMTP Host: `smtp.gmail.com`
       - SMTP Port: `587`
       - SMTP User: Your Gmail address
       - SMTP Password: App-specific password (not your regular password)
     - **SendGrid**:
       - SMTP Host: `smtp.sendgrid.net`
       - SMTP Port: `587`
       - SMTP User: `apikey`
       - SMTP Password: Your SendGrid API key
     - **AWS SES**:
       - SMTP Host: Your SES SMTP endpoint
       - SMTP Port: `587`
       - SMTP User: Your SES SMTP username
       - SMTP Password: Your SES SMTP password

4. **Configure Email Templates:**
   - Go to Authentication → Email Templates
   - Customize the "Confirm signup" template if needed
   - Ensure the confirmation link includes: `{{ .ConfirmationURL }}`

5. **Set Site URL:**
   - Go to Authentication → URL Configuration
   - Set "Site URL" to your production domain (e.g., `https://your-app.vercel.app`)
   - Add redirect URLs if needed

### Option 2: Disable Email Confirmation (Development Only)

**⚠️ WARNING: Only use this for development/testing. Never disable email confirmation in production!**

1. **Go to Supabase Dashboard** → Authentication → Settings
2. **Find "Email Auth" section**
3. **Turn OFF "Confirm email"**
4. **Save changes**

After this, users can sign up and immediately log in without email confirmation.

### Option 3: Manually Confirm Users (Quick Fix)

If you need to manually confirm a user right now:

1. **Go to Supabase Dashboard** → Authentication → Users
2. **Find the user** (search by email: `amosmalik999@gmail.com`)
3. **Click on the user**
4. **Click "Confirm Email" button** or toggle "Email Confirmed" to ON
5. **User can now log in**

### Option 4: Use SQL to Confirm User

Run this in Supabase SQL Editor:

```sql
-- Find the user
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'amosmalik999@gmail.com';

-- Manually confirm the user (replace <user_id> with actual ID from above)
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'amosmalik999@gmail.com'
  AND email_confirmed_at IS NULL;

-- Verify
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'amosmalik999@gmail.com';
```

## Testing Email Configuration

After configuring email:

1. **Test with a new signup:**
   - Sign up with a test email
   - Check spam folder
   - Check email provider logs (if using custom SMTP)

2. **Check Supabase Logs:**
   - Go to Logs → Auth Logs
   - Look for email sending errors

3. **Verify Email Templates:**
   - Go to Authentication → Email Templates
   - Test the "Confirm signup" template
   - Ensure `{{ .ConfirmationURL }}` is in the template

## Common Issues

1. **Emails going to spam:**
   - Configure SPF/DKIM records for your domain
   - Use a reputable email provider (SendGrid, AWS SES, etc.)

2. **Rate limiting:**
   - Supabase's built-in email has rate limits
   - Use custom SMTP for production

3. **Wrong redirect URL:**
   - Ensure Site URL is set correctly
   - Check email template includes correct domain

## Quick Fix for Current User

To immediately allow `amosmalik999@gmail.com` to log in:

```sql
-- Confirm the user
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'amosmalik999@gmail.com';

-- Then they can log in and the profile will be created automatically
```
