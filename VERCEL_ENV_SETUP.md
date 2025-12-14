# Vercel Environment Variables Setup Guide

## Important: After Adding Environment Variables

After adding environment variables in Vercel, you **MUST** redeploy your application for them to take effect.

### Steps:

1. **Add Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add these variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Make sure to select **all environments** (Production, Preview, Development)

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
- **Build fails:** Make sure all three variables are set for all environments

## Getting Your Supabase Credentials:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

