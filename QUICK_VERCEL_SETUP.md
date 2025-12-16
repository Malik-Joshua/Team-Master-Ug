# 🚨 URGENT: Set Environment Variables in Vercel

## Current Issue
Your app is deployed but **Supabase environment variables are NOT SET**. The console shows:
- `hasUrl: false`
- `hasKey: false`
- `supabaseKeys: []` (empty array)
- `missingVariables: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]`

**Note:** You have 18 Vercel environment variables, but the Supabase ones are missing!

## ⚡ Quick Fix (5 minutes)

### Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **API**
4. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
   - **service_role** key (long string starting with `eyJ...`)

### Step 2: Add Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Find your **TeamMaster** project
3. Click **Settings** (gear icon)
4. Click **Environment Variables** in the left sidebar
5. Add these **3 variables**:

#### Variable 1: `NEXT_PUBLIC_SUPABASE_URL`
- **Key:** `NEXT_PUBLIC_SUPABASE_URL` (copy exactly, case-sensitive)
- **Value:** Your Supabase Project URL (from Step 1)
- **Environment:** ✅ Check **ALL THREE**: Production, Preview, Development
- Click **Save**

#### Variable 2: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (copy exactly, case-sensitive)
- **Value:** Your Supabase anon public key (from Step 1)
- **Environment:** ✅ Check **ALL THREE**: Production, Preview, Development
- Click **Save**

#### Variable 3: `SUPABASE_SERVICE_ROLE_KEY`
- **Key:** `SUPABASE_SERVICE_ROLE_KEY` (copy exactly, case-sensitive)
- **Value:** Your Supabase service_role key (from Step 1)
- **Environment:** ✅ Check **ONLY Production** (security: don't use in preview/dev)
- Click **Save**

### Step 3: Redeploy (CRITICAL!)

**You MUST redeploy after adding variables:**

1. Go to **Deployments** tab in Vercel
2. Find your latest deployment
3. Click the **three dots (⋯)** menu
4. Click **"Redeploy"**
5. **IMPORTANT:** Uncheck **"Use existing Build Cache"** (if available)
6. Click **"Redeploy"**

**OR** push a new commit to trigger a fresh build:
```bash
git commit --allow-empty -m "Trigger rebuild with env vars"
git push
```

### Step 4: Verify

1. Wait for deployment to complete (2-3 minutes)
2. Visit your Vercel URL
3. Open browser console (F12)
4. You should see:
   - `hasUrl: true`
   - `hasKey: true`
   - `urlPreview: "https://xxxxx..."`

## ✅ Success Checklist

- [ ] All 3 variables added in Vercel
- [ ] `NEXT_PUBLIC_*` variables set for ALL environments
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set for Production ONLY
- [ ] Redeployed without build cache
- [ ] Console shows `hasUrl: true` and `hasKey: true`

## 🔍 Troubleshooting

**Still seeing `hasUrl: false`?**
- ✅ Did you redeploy after adding variables?
- ✅ Are variable names exactly correct? (case-sensitive, no spaces)
- ✅ Did you check the correct environment checkboxes?
- ✅ Try redeploying again with build cache disabled

**Build fails?**
- Check build logs in Vercel
- Ensure all `NEXT_PUBLIC_*` variables are set for all environments
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is only in Production

**Authentication not working?**
- Wait 2-3 minutes after redeploy
- Clear browser cache and cookies
- Try in incognito/private window

## 📞 Need Help?

If variables are set but still not working:
1. Check Vercel build logs for errors
2. Verify variable values are correct (no extra spaces)
3. Make sure you're checking the Production environment
4. Try redeploying with a new commit

