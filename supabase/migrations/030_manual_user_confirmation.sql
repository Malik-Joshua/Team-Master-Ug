-- Migration: Manually confirm user email
-- Use this to manually confirm a user's email if email confirmation is not working

-- Step 1: Find the user
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  confirmed_at
FROM auth.users
WHERE email = 'amosmalik999@gmail.com';

-- Step 2: Manually confirm the user
-- This will allow them to log in without email confirmation
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email = 'amosmalik999@gmail.com'
  AND (email_confirmed_at IS NULL OR confirmed_at IS NULL);

-- Step 3: Verify the confirmation
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email Confirmed'
    ELSE '❌ Not Confirmed'
  END as status
FROM auth.users
WHERE email = 'amosmalik999@gmail.com';

-- Step 4: Check if profile needs to be created
-- After confirming email, the user should log in and the profile will be created automatically
-- But you can check if there's pending signup data:
SELECT 
  id,
  user_id,
  name,
  email,
  role,
  created_at,
  expires_at,
  CASE 
    WHEN expires_at < NOW() THEN '❌ Expired'
    ELSE '✅ Active'
  END as status
FROM pending_signups
WHERE email = 'amosmalik999@gmail.com'
ORDER BY created_at DESC;

-- If the user is confirmed and has pending signup data, they can now log in
-- The login page will automatically call /api/auth/complete-signup to create the profile
