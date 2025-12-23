# 🚨 URGENT: Add Service Role Key to Vercel

## Current Error
"Server configuration error: Service role key is missing"

This means `SUPABASE_SERVICE_ROLE_KEY` is **NOT SET** in your Vercel environment variables.

## ⚡ Quick Fix (3 minutes)

### Step 1: Get Your Service Role Key from Supabase

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your **TeamMaster** project (or whatever your project is named)

2. **Navigate to API Settings:**
   - Click **Settings** (gear icon in left sidebar)
   - Click **API** in the settings menu

3. **Find the Service Role Key:**
   - Scroll down to find **"service_role"** key
   - ⚠️ **IMPORTANT:** This is different from the "anon public" key
   - It's a long string starting with `eyJ...`
   - Click the **eye icon** or **copy button** to reveal and copy it
   - ⚠️ **SECURITY WARNING:** This key has full database access - keep it secret!

### Step 2: Add to Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Find your **TeamMaster** project
   - Click on it

2. **Navigate to Environment Variables:**
   - Click **Settings** (gear icon)
   - Click **Environment Variables** in the left sidebar

3. **Add the Variable:**
   - Click **"Add New"** or **"+"** button
   - **Key:** Type exactly: `SUPABASE_SERVICE_ROLE_KEY`
     - ⚠️ Must be exact, case-sensitive, no spaces
   - **Value:** Paste the service_role key you copied from Supabase
   - **Environment:** 
     - ✅ Check **Production** (REQUIRED)
     - ❌ Do NOT check Preview (for security)
     - ❌ Do NOT check Development (for security)
   - Click **Save**

### Step 3: Redeploy

**CRITICAL:** You MUST redeploy after adding the variable:

1. Go to **Deployments** tab
2. Find your **latest deployment**
3. Click the **three dots (⋯)** menu
4. Click **"Redeploy"**
5. **IMPORTANT:** Uncheck **"Use existing Build Cache"** (if available)
6. Click **"Redeploy"**
7. Wait 2-3 minutes for deployment to complete

### Step 4: Verify

1. After deployment completes, try signing up again
2. The error should be gone
3. User accounts should be created successfully

## ✅ Checklist

- [ ] Service role key copied from Supabase Dashboard → Settings → API
- [ ] Variable added to Vercel: `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Value is correct (long string starting with `eyJ...`)
- [ ] **Production** checkbox is checked ✅
- [ ] Preview and Development are **NOT** checked ❌
- [ ] Redeployed without build cache
- [ ] Tested signup - works now!

## 🔒 Security Notes

- **NEVER** commit the service role key to git
- **ONLY** set it for Production environment in Vercel
- This key bypasses all RLS policies - treat it as highly sensitive
- If exposed, regenerate it in Supabase Dashboard

## 🆘 Still Not Working?

If after adding the key and redeploying you still get the error:

1. **Double-check the variable name:**
   - Must be exactly: `SUPABASE_SERVICE_ROLE_KEY`
   - No typos, no spaces, case-sensitive

2. **Verify it's set for Production:**
   - Click on the variable in Vercel
   - Make sure Production checkbox is checked

3. **Check build logs:**
   - Go to Deployments → Latest → Build Logs
   - Search for "SUPABASE_SERVICE_ROLE_KEY"
   - Should see it's being used (value won't be shown for security)

4. **Try redeploying again:**
   - Sometimes Vercel needs a fresh build to pick up new variables

## 📞 Need Help?

If you've followed all steps and it's still not working:
1. Check Vercel build logs for errors
2. Verify the service role key is correct in Supabase
3. Make sure you're testing on the Production URL (not preview)

