# 🔧 FORCE REBUILD - Environment Variables Not Working

## The Problem
You've added environment variables in Vercel, but they're still showing as `hasUrl: false` and `hasKey: false`.

**This means the variables weren't embedded during the build.**

## ⚡ Quick Fix (Choose One Method)

### Method 1: Force Rebuild via Code Change (MOST RELIABLE)

1. **Make a small code change to trigger a fresh build:**
   ```bash
   # In your terminal, run:
   echo "// Force rebuild $(date)" >> app/login/page.tsx
   git add app/login/page.tsx
   git commit -m "Force rebuild for environment variables"
   git push
   ```

2. **Wait for Vercel to build** (2-3 minutes)

3. **Check the build logs:**
   - Go to Vercel Dashboard → Deployments → Latest deployment
   - Click "Build Logs"
   - Search for `NEXT_PUBLIC_SUPABASE`
   - You should see the variables being used

### Method 2: Clear Build Cache in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**
2. Scroll down to **"Build & Development Settings"**
3. Click **"Clear Build Cache"** button
4. Go to **Deployments** tab
5. Click **three dots (⋯)** on latest deployment
6. Click **"Redeploy"**
7. **IMPORTANT:** Uncheck **"Use existing Build Cache"** if available
8. Click **"Redeploy"**

### Method 3: Verify Variables Are Set Correctly

**Double-check in Vercel:**

1. Go to **Settings** → **Environment Variables**
2. For EACH variable (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`):
   - Click on the variable name
   - Verify:
     - ✅ Value is NOT empty
     - ✅ No leading/trailing spaces
     - ✅ **Production** checkbox is checked ✅
     - ✅ **Preview** checkbox is checked ✅
     - ✅ **Development** checkbox is checked ✅

3. **Common mistakes:**
   - ❌ Variable name has a typo (e.g., `NEXT_PUBLIC_SUPABASE_UR` instead of `NEXT_PUBLIC_SUPABASE_URL`)
   - ❌ Production checkbox not checked
   - ❌ Value has extra spaces at the beginning/end
   - ❌ Variable was added AFTER the last build

## 🔍 Debug: Check Server-Side Variables

Visit this URL on your Vercel site:
```
https://your-vercel-url.vercel.app/api/check-env
```

This will show you:
- What variables the SERVER can see (different from client)
- Which variables are missing
- All NEXT_PUBLIC_ keys found

**If the server shows the variables but the client doesn't:**
- The variables ARE set, but weren't embedded at build time
- **Solution:** Force a fresh rebuild (Method 1 or 2)

**If the server also shows missing variables:**
- The variables aren't set correctly in Vercel
- **Solution:** Re-add them following Method 3

## ✅ Verification Steps

After rebuilding:

1. **Check build logs:**
   - Vercel Dashboard → Deployments → Latest → Build Logs
   - Search for `NEXT_PUBLIC_SUPABASE`
   - Should see variables being used

2. **Check browser console:**
   - Visit your site
   - Open Console (F12)
   - Should see: `hasUrl: true, hasKey: true`

3. **Check server endpoint:**
   - Visit `/api/check-env`
   - Should see: `"message": "✅ Supabase environment variables are configured"`

## 🚨 Still Not Working?

If after all steps you still see `hasUrl: false`:

1. **Check Vercel build logs for errors**
2. **Verify you're checking the Production environment** (not Preview)
3. **Try deleting and re-adding the variables:**
   - Delete both variables
   - Add them again one by one
   - Make sure Production is checked
   - Force a rebuild

4. **Contact Vercel support** if variables are set correctly but still not working

