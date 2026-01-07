# Vercel Environment Variables - Debug Checklist

## Step 1: Verify Variables Are Set in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Verify you see these EXACT variable names (case-sensitive, no spaces):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. For EACH variable, click on it to verify:
   - ✅ The value is NOT empty
   - ✅ The value doesn't have leading/trailing spaces
   - ✅ For URL: Should start with `https://` and end with `.supabase.co`
   - ✅ For Key: Should be a long string starting with `eyJ`
   - ✅ **Production** checkbox is checked
   - ✅ **Preview** checkbox is checked (if you're testing preview)
   - ✅ **Development** checkbox is checked (if you're testing dev)

## Step 2: Check Build Logs

1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Click on the **latest deployment**
3. Click **Build Logs** tab
4. Search for `NEXT_PUBLIC_SUPABASE` in the logs
5. You should see the variables being used during the build
6. **If you see `undefined` or the variables are missing**, they weren't available during build

## Step 3: Check Browser Console

1. Visit your Vercel URL (the production URL, not preview)
2. Open **Developer Tools** (F12)
3. Go to **Console** tab
4. Look for this log message:
   ```
   Environment check: {
     hasUrl: true/false,
     hasKey: true/false,
     urlLength: 0 or some number,
     keyLength: 0 or some number,
     ...
   }
   ```

### What the values mean:

- **`hasUrl: false` and `hasKey: false`** 
  - ❌ Variables were NOT embedded at build time
  - **Solution**: Variables must be set BEFORE building. Force a fresh rebuild.

- **`hasUrl: true` and `hasKey: true`**
  - ✅ Variables ARE present
  - If you still see errors, the issue is elsewhere (check error message)

## Step 4: Force a Fresh Build (If Variables Are Missing)

### Option A: Via Vercel Dashboard (Recommended)

1. Go to **Deployments** tab
2. Click **three dots (⋯)** on latest deployment
3. Click **"Redeploy"**
4. **IMPORTANT**: Look for a checkbox that says "Use existing Build Cache" or "Use Build Cache"
5. **UNCHECK** that checkbox
6. Click **"Redeploy"**
7. Wait for build to complete (2-3 minutes)

### Option B: Via Git Push (If checkbox not available)

```bash
# Make a tiny change to force rebuild
echo "" >> app/login/page.tsx
git add app/login/page.tsx
git commit -m "Force rebuild - clear cache"
git push
```

## Step 5: Verify After Rebuild

After the new deployment completes:

1. Visit your Vercel URL
2. Open Console (F12)
3. Check the "Environment check:" log again
4. If `hasUrl` and `hasKey` are still `false`:
   - Double-check variable names in Vercel (exact spelling)
   - Verify values are not empty
   - Make sure Production is checked
   - Try deleting and re-adding the variables

## Common Issues

### Issue: Variables set but still showing as missing
**Possible causes:**
- Variables were added AFTER the build
- Build cache was used (variables weren't re-embedded)
- Variable names have typos or extra spaces
- Variables are set for wrong environment (Preview vs Production)

### Issue: Can't find "Use existing Build Cache" checkbox
**Solution:**
- Use Option B (Git push) to force a fresh build
- Or go to Settings → General → Clear Build Cache

### Issue: Build logs show variables but console shows missing
**Solution:**
- This shouldn't happen - if it does, there's a caching issue
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Try incognito/private window

## Still Not Working?

If after all these steps the variables are still missing:

1. **Screenshot the Vercel Environment Variables page** (hide sensitive values)
2. **Copy the "Environment check:" console log output**
3. **Copy the relevant build log section** (the part showing NEXT_PUBLIC_SUPABASE)

These will help diagnose the exact issue.





















