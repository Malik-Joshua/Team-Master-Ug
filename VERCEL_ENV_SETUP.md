# Vercel Environment Variables Setup Guide

## Important: After Adding Environment Variables

After adding environment variables in Vercel, you **MUST** redeploy your application for them to take effect.

### Steps:

1. **Add Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add these variables:
     - `NEXT_PUBLIC_SUPABASE_URL` - Select **all environments** (Production, Preview, Development)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Select **all environments** (Production, Preview, Development)
     - `SUPABASE_SERVICE_ROLE_KEY` - Select **ONLY Production** (⚠️ Security: This key has elevated privileges and should not be in Preview/Development)

2. **Redeploy:**
   - Go to Deployments tab
   - Click the three dots (⋯) on the latest deployment
   - Select **"Redeploy"**
   - OR push a new commit to trigger a new deployment

3. **Verify:**
   - After redeployment completes, check the build logs
   - Visit your Vercel URL and check the browser console (F12)
   - You should see "Supabase configured" in the console

## Common Issues:

- **Variables not showing up:** Make sure you redeployed after adding them
- **Still getting errors:** Check that variable names are exactly:
  - `NEXT_PUBLIC_SUPABASE_URL` (not `SUPABASE_URL`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `SUPABASE_ANON_KEY`)
- **Build fails:** Make sure public variables (`NEXT_PUBLIC_*`) are set for all environments, and `SUPABASE_SERVICE_ROLE_KEY` is set only for Production

## Getting Your Supabase Credentials:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`


