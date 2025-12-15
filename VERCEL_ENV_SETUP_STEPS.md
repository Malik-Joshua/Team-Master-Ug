# Step-by-Step Guide: Adding Environment Variables to Vercel

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project (or create one if you haven't)
4. Click on **Settings** (gear icon) in the left sidebar
5. Click on **API** in the Settings menu
6. You'll see three important values:
   - **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key - This is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

7. **Copy each value** - You'll need them in the next steps

---

## Step 2: Access Vercel Project Settings

1. Go to https://vercel.com/dashboard
2. Sign in to your Vercel account
3. Find your **TeamMaster** project in the dashboard
4. Click on the project name to open it
5. Click on the **Settings** tab at the top
6. In the left sidebar under Settings, click on **Environment Variables**

---

## Step 3: Add First Environment Variable (NEXT_PUBLIC_SUPABASE_URL)

1. In the Environment Variables page, you'll see a form with:
   - **Key** field (variable name)
   - **Value** field (the actual value)
   - **Environment** checkboxes (Production, Preview, Development)

2. For the first variable:
   - **Key**: Type exactly: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Paste the **Project URL** you copied from Supabase (should look like: `https://xxxxx.supabase.co`)
   - **Environment**: Check all three boxes:
     - ☑ Production
     - ☑ Preview
     - ☑ Development

3. Click the **Save** button

---

## Step 4: Add Second Environment Variable (NEXT_PUBLIC_SUPABASE_ANON_KEY)

1. Click **Add New** or the **+** button to add another variable
2. For the second variable:
   - **Key**: Type exactly: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Paste the **anon public** key you copied from Supabase (a long string starting with `eyJ...`)
   - **Environment**: Check all three boxes:
     - ☑ Production
     - ☑ Preview
     - ☑ Development

3. Click the **Save** button

---

## Step 5: Add Third Environment Variable (SUPABASE_SERVICE_ROLE_KEY)

1. Click **Add New** or the **+** button to add another variable
2. For the third variable:
   - **Key**: Type exactly: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste the **service_role** key you copied from Supabase (a long string starting with `eyJ...`)
   - **Environment**: Check all three boxes:
     - ☑ Production
     - ☑ Preview
     - ☑ Development

3. Click the **Save** button

---

## Step 6: Verify All Variables Are Added

You should now see three environment variables listed:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`

**Important:** Make sure:
- ✅ All three variables are present
- ✅ All three have checkmarks for Production, Preview, and Development
- ✅ Variable names are spelled exactly as shown (case-sensitive!)

---

## Step 7: Redeploy Your Application

**This is critical!** Environment variables only take effect after a new deployment.

### Option A: Redeploy from Vercel Dashboard (Recommended)

1. Click on the **Deployments** tab at the top
2. Find the latest deployment in the list
3. Click the **three dots (⋯)** on the right side of that deployment
4. Click **Redeploy** from the dropdown menu
5. Confirm the redeployment
6. Wait for the deployment to complete (usually 2-3 minutes)
7. You'll see a green checkmark when it's done

### Option B: Trigger Deployment via Git Push

1. Make a small change to any file (or just add a comment)
2. Commit and push to your repository:
   ```bash
   git add .
   git commit -m "Trigger redeploy for environment variables"
   git push
   ```
3. Vercel will automatically detect the push and start a new deployment
4. Wait for it to complete

---

## Step 8: Verify It's Working

1. After the deployment completes, click on your project URL (or visit your Vercel domain)
2. Open the browser's Developer Tools:
   - Press `F12` or right-click → **Inspect**
   - Go to the **Console** tab
3. Look for these messages:
   - ✅ "Environment check:" - Should show `hasUrl: true` and `hasKey: true`
   - ✅ "Supabase configured:" - Confirms variables are loaded
4. If you see "Supabase is not configured" error, check:
   - Did you redeploy after adding variables?
   - Are the variable names spelled exactly correctly?
   - Are all three environments (Production, Preview, Development) checked?

---

## Troubleshooting

### Problem: Variables still not working after redeploy
**Solution:**
- Double-check variable names are exactly: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Make sure you checked all three environment types
- Try deleting and re-adding the variables
- Check the Vercel build logs for any errors

### Problem: Can't find Environment Variables in Settings
**Solution:**
- Make sure you're in the correct project
- You need to be the project owner or have admin access
- Try refreshing the page

### Problem: Build fails after adding variables
**Solution:**
- Check that all variable values are correct (no extra spaces)
- Make sure the Supabase URL starts with `https://`
- Verify the keys are complete (they're long strings)

---

## Quick Checklist

Before considering it done, verify:
- [ ] All three environment variables are added
- [ ] All variables have Production, Preview, and Development checked
- [ ] Variable names are spelled exactly as shown (case-sensitive)
- [ ] You've redeployed the application
- [ ] Deployment completed successfully
- [ ] Browser console shows "Supabase configured"

---

## Need Help?

If you're still having issues:
1. Check the Vercel deployment logs for errors
2. Check the browser console (F12) for error messages
3. Verify your Supabase project is active and accessible
4. Make sure you're using the correct Supabase project credentials

