# Fix Signup Foreign Key Error

## Problem
Error: "Failed to create profile: insert or update on table "user_profiles" violates foreign key constraint "user_profiles_user_id_fkey""

## Root Cause
The signup flow was trying to create a `user_profiles` entry before the user was fully confirmed in `auth.users`, causing a foreign key constraint violation.

## Solution Implemented
1. **Created `pending_signups` table** - Stores signup data temporarily (no foreign key constraint)
2. **Modified signup API** - Now only saves to `pending_signups`, never creates profiles
3. **Created `complete-signup` API** - Creates profile after email confirmation when user logs in
4. **Updated login flow** - Automatically calls `complete-signup` if no profile exists

## Required Steps to Fix

### Step 1: Run Database Migration
Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/028_pending_signups_table.sql
```

This creates the `pending_signups` table without a foreign key constraint.

### Step 2: Deploy Updated Code
The code changes need to be deployed to Vercel:

```bash
git add .
git commit -m "Fix signup foreign key error - use pending_signups flow"
git push origin main
```

Vercel will automatically build and deploy.

### Step 3: Verify
1. Try signing up a new user
2. Check email for confirmation link
3. Confirm email
4. Log in - profile should be created automatically

## How It Works Now

1. **User signs up** → Data saved to `pending_signups` (no profile created)
2. **User confirms email** → User exists in `auth.users`
3. **User logs in** → Login page detects no profile → Calls `/api/auth/complete-signup` → Profile created

## Important Notes

- The signup API (`/api/auth/signup`) **NEVER** creates profiles anymore
- Profile creation only happens in `/api/auth/complete-signup` after email confirmation
- The `pending_signups` table has **NO foreign key constraint** to avoid errors
- Pending signups expire after 7 days

## Troubleshooting

If you still see the error:
1. **Check migration was run** - Verify `pending_signups` table exists in Supabase
2. **Check deployment** - Ensure latest code is deployed on Vercel
3. **Clear browser cache** - Old JavaScript might be cached
4. **Check Supabase logs** - Look for any database errors
