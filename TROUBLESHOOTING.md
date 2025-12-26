# Troubleshooting Guide

## Issue: 500 Errors on `/api/admin/players` and `/api/admin/inventory`

### Step 1: Verify Environment Variable is Set

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Check Environment Variables:**
   - Go to **Settings** → **Environment Variables**
   - Look for `SUPABASE_SERVICE_ROLE_KEY`
   - Verify it's set for **Production** environment

3. **Verify the Key Value:**
   - The key should start with `eyJ...` (it's a JWT token)
   - It should be the **service_role** key (NOT the anon key)
   - Get it from: Supabase Dashboard → Settings → API → service_role key

### Step 2: Redeploy After Adding Variable

**CRITICAL:** After adding/changing environment variables, you MUST redeploy:

1. Go to **Deployments** tab
2. Click the **three dots (⋯)** on the latest deployment
3. Click **"Redeploy"**
4. **Uncheck** "Use existing Build Cache" (if available)
5. Click **"Redeploy"**
6. Wait 2-3 minutes for deployment to complete

### Step 3: Check Deployment Status

1. Go to **Deployments** tab in Vercel
2. Check if the latest deployment shows:
   - ✅ **Ready** (green checkmark) = Success
   - ⏳ **Building** = Still deploying, wait
   - ❌ **Error** = Build failed, check logs

### Step 4: Check Build Logs

1. Click on the deployment
2. Click **"View Build Logs"** or **"Logs"** tab
3. Look for errors related to:
   - Environment variables
   - Build failures
   - TypeScript errors

### Step 5: Test the Diagnostic Endpoint

After deployment completes, test the diagnostic endpoint:

1. Open your browser console (F12)
2. Run this command:
   ```javascript
   fetch('/api/admin/test-env').then(r => r.json()).then(console.log)
   ```

3. Check the response:
   - `hasServiceRoleKey: true` = Variable is set ✅
   - `hasServiceRoleKey: false` = Variable is NOT set ❌
   - `testQuery.success: true` = Everything working ✅
   - `testQuery.success: false` = Database connection issue

### Step 6: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to **Console** tab
3. Look for error messages when loading the inventory/players pages
4. Common errors:
   - `500 Internal Server Error` = API route error
   - `Failed to fetch` = Network error
   - `Missing SUPABASE_SERVICE_ROLE_KEY` = Environment variable not set

### Step 7: Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project
2. Click **"Logs"** tab
3. Filter by `/api/admin/players` or `/api/admin/inventory`
4. Look for error messages

## Common Issues and Solutions

### Issue: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Solution:**
1. Add the variable in Vercel (Settings → Environment Variables)
2. Make sure it's set for **Production**
3. **Redeploy** the application
4. Wait for deployment to complete

### Issue: "Deployment Not Found" (404)

**Possible causes:**
- Wrong URL (check your Vercel project URL)
- Deployment hasn't completed yet
- Deployment failed

**Solution:**
1. Check Vercel Dashboard → Deployments
2. Verify the deployment status
3. Use the correct project URL from Vercel

### Issue: Environment Variable Set But Still Getting 500 Errors

**Possible causes:**
- Variable set for wrong environment (Preview instead of Production)
- Variable value is incorrect (wrong key)
- Need to redeploy after adding variable

**Solution:**
1. Verify variable is set for **Production**
2. Double-check the key value (should be service_role key)
3. Redeploy the application
4. Check function logs for specific error messages

### Issue: "Failed to fetch inventory items"

**Possible causes:**
- Database connection issue
- RLS (Row Level Security) blocking access
- Table doesn't exist

**Solution:**
1. Check Supabase Dashboard → Table Editor → Verify `inventory` table exists
2. Check RLS policies in Supabase
3. Verify service role key has correct permissions

## Still Having Issues?

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Logs
   - Filter by the failing API route
   - Look for detailed error messages

2. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Check Console and Network tabs
   - Look for error responses

3. **Verify Supabase Setup:**
   - Ensure tables exist (`inventory`, `user_profiles`, `players`)
   - Check RLS policies
   - Verify service role key is valid

4. **Test Locally:**
   - Run `npm run dev` locally
   - Set environment variables in `.env.local`
   - Test if it works locally

