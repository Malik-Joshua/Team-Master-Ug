# Fix: RLS Policy Error During Signup

## Problem
Getting error: "new row violates row-level security policy for table 'user_profiles'"

## Root Cause
The `SUPABASE_SERVICE_ROLE_KEY` environment variable is **NOT SET** in Vercel, or it's not set for the Production environment.

## Solution

### Step 1: Verify Service Role Key in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Look for `SUPABASE_SERVICE_ROLE_KEY`
3. **If it's missing**, add it:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY` (exact, case-sensitive)
   - **Value:** Your Supabase service_role key (from Supabase Dashboard → Settings → API)
   - **Environment:** ✅ Check **ONLY Production** (for security)
   - Click **Save**

### Step 2: Get Your Service Role Key

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Find **service_role** key (NOT the anon key)
5. Copy it (it's a long string starting with `eyJ...`)

### Step 3: Add to Vercel

1. In Vercel, add the variable:
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (paste the service_role key)
   - **IMPORTANT:** Only check **Production** (don't check Preview/Development for security)

### Step 4: Redeploy

After adding the variable:
1. Go to **Deployments** tab
2. Click **three dots (⋯)** on latest deployment
3. Click **"Redeploy"**
4. Uncheck **"Use existing Build Cache"** if available
5. Click **"Redeploy"**

## Why This Is Needed

The signup API route uses the service role key to bypass RLS (Row Level Security) when creating user profiles. This is necessary because:

1. After signup, the user's session might not be immediately available
2. RLS policies require `auth.uid() = user_id`, but `auth.uid()` might not be set yet
3. The service role key bypasses all RLS policies, allowing profile creation

## Security Note

⚠️ **Important:** The service role key has full access to your database and bypasses all RLS policies. Only set it for Production environment, never commit it to git, and keep it secure.

## Verification

After redeploying, try signing up again. The error should be resolved.

If you still get the error:
1. Check Vercel build logs to see if the variable is being read
2. Verify the variable name is exactly `SUPABASE_SERVICE_ROLE_KEY` (no typos)
3. Make sure Production checkbox is checked
4. Try redeploying again

