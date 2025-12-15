# Troubleshooting: "Supabase is not configured" on Vercel

## The Problem

You've added the environment variables to Vercel and redeployed, but you're still seeing the error: "Supabase is not configured."

## Root Cause

In Next.js, `NEXT_PUBLIC_*` environment variables are **embedded at BUILD TIME**, not runtime. This means:

- ✅ Variables must exist **BEFORE** the build starts
- ❌ Adding variables after a build won't help until you rebuild
- ❌ A "redeploy" might reuse a cached build if your code hasn't changed

## Solutions (Try in Order)

### Solution 1: Force a Fresh Build (Most Common Fix)

Vercel caches builds. If you added variables after a build, you need to force a fresh build:

1. **Option A: Make a code change and push**
   ```bash
   # Make a small change (add a comment or space)
   echo "// Force rebuild" >> app/login/page.tsx
   git add .
   git commit -m "Force rebuild for environment variables"
   git push
   ```

2. **Option B: Clear build cache in Vercel**
   - Go to Vercel Dashboard → Your Project → Settings → General
   - Scroll to "Build & Development Settings"
   - Click "Clear Build Cache"
   - Then redeploy

3. **Option C: Redeploy with "Use existing Build Cache" UNCHECKED**
   - Go to Deployments tab
   - Click the three dots (⋯) on latest deployment
   - Click "Redeploy"
   - **IMPORTANT**: Uncheck "Use existing Build Cache"
   - Click "Redeploy"

### Solution 2: Verify Variables Are Set Correctly

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify you see:
   - `NEXT_PUBLIC_SUPABASE_URL` (exact spelling, no spaces)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (exact spelling, no spaces)
3. For each variable, check:
   - ✅ Production is checked
   - ✅ Preview is checked (if testing preview)
   - ✅ Development is checked (if testing dev)
4. Click on each variable to verify:
   - The value is not empty
   - The value doesn't have extra spaces at the start/end
   - The URL starts with `https://`
   - The key starts with `eyJ` (JWT token format)

### Solution 3: Check Build Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Click "Build Logs"
4. Search for "NEXT_PUBLIC_SUPABASE"
5. You should see the variables being used during build
6. If you see "undefined" or they're missing, the variables weren't available during build

### Solution 4: Verify Environment Match

Make sure you're viewing the correct environment:
- **Production URL** (e.g., `your-app.vercel.app`) → Needs Production variables
- **Preview URL** (e.g., `your-app-git-branch.vercel.app`) → Needs Preview variables
- **Development** → Needs Development variables

### Solution 5: Delete and Re-add Variables

Sometimes Vercel needs variables to be re-added:

1. Go to Settings → Environment Variables
2. Delete `NEXT_PUBLIC_SUPABASE_URL`
3. Delete `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Add them back with exact spelling
5. Make sure all environments are checked
6. Force a fresh build (Solution 1)

## How to Verify It's Working

After redeploying, check the browser console (F12):

1. Open your Vercel URL
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for:
   - ✅ "Environment check:" with `hasUrl: true` and `hasKey: true`
   - ✅ "Supabase configured:" message
   - ❌ If you see "Environment variables MISSING", the build didn't pick them up

## Common Mistakes

1. **Adding variables after build** - Variables must exist before build
2. **Typo in variable name** - Must be exactly `NEXT_PUBLIC_SUPABASE_URL` (case-sensitive)
3. **Only checking Production** - If viewing Preview, need Preview variables too
4. **Extra spaces** - Copy/paste might add spaces, check the value
5. **Using cached build** - Must force fresh build after adding variables

## Still Not Working?

If none of the above work:

1. Check Vercel build logs for errors
2. Verify your Supabase project is active
3. Try creating a new deployment from a new commit
4. Contact Vercel support with your deployment logs

