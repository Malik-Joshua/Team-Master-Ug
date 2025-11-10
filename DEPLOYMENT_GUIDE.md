# Deployment Guide - Share Your App with Clients

This guide will help you deploy your Mongers Rugby Club Management app to Vercel so you can share a live link with your client.

## 🚀 Quick Deploy to Vercel (Recommended)

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Prepare Your Code**
   - Make sure all your code is committed to Git
   - Push to GitHub, GitLab, or Bitbucket

2. **Sign Up/Login to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up or login (you can use GitHub to sign in)

3. **Import Your Project**
   - Click "Add New Project"
   - Import your Git repository
   - Vercel will auto-detect Next.js

4. **Configure Environment Variables**
   - In the project settings, go to "Environment Variables"
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - For production, make sure to add them to "Production" environment

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (2-3 minutes)
   - You'll get a URL like: `https://your-app-name.vercel.app`

6. **Share the Link**
   - Copy the deployment URL
   - Share it with your client!

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? (press enter for default)
# - Directory? (press enter for ./)
# - Override settings? No

# For production deployment
vercel --prod
```

## 📋 Pre-Deployment Checklist

Before deploying, make sure:

- [ ] All code is committed to Git
- [ ] Environment variables are ready
- [ ] App builds successfully (`npm run build`)
- [ ] Database migration is run in Supabase
- [ ] Test the app locally first

## 🔧 Environment Variables Setup

In Vercel Dashboard → Settings → Environment Variables, add:

### Required Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Optional Variables:
```
XAI_API_KEY=your_xai_key (if using AI features)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important**: 
- Add these to **Production**, **Preview**, and **Development** environments
- After adding variables, redeploy the app

## 🎯 Client Access Instructions

Once deployed, share this with your client:

### Demo Access Instructions

1. **Visit the App**: [Your Vercel URL]
2. **Login Options**:
   - **Development Mode**: Click "Access Dashboard (Dev Mode)"
   - Select a role: Player, Coach, Data Admin, Finance Admin, or Admin
   - Click "Access Dashboard"

3. **Available Features**:
   - **Player Role**: Profile, Performance, Messages, Dashboard
   - **Coach Role**: Players, Training, Messages, Dashboard
   - **Data Admin**: Match Stats, Training, Inventory, Reports
   - **Finance Admin**: Financial Management, Reports
   - **Admin**: Full access to all features

4. **Testing Checklist**:
   - ✅ Navigate through all dashboards
   - ✅ Test data entry forms
   - ✅ Check responsive design (mobile/tablet)
   - ✅ Verify all features are accessible
   - ✅ Test AI Assistant (bottom-right button)

## 🔄 Updating the Deployment

When you make changes:

1. **Push to Git**:
   ```bash
   git add .
   git commit -m "Update: description of changes"
   git push
   ```

2. **Vercel Auto-Deploys**:
   - If connected to Git, Vercel automatically deploys on push
   - Check Vercel dashboard for deployment status

3. **Manual Deploy**:
   ```bash
   vercel --prod
   ```

## 🌐 Custom Domain (Optional)

To use a custom domain:

1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation (can take up to 24 hours)

## 📊 Monitoring & Analytics

Vercel provides:
- **Analytics**: View page views, performance metrics
- **Logs**: Check deployment and runtime logs
- **Speed Insights**: Monitor page load times

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set

### App Not Loading
- Check if environment variables are correct
- Verify Supabase connection
- Check browser console for errors

### Database Errors
- Ensure Supabase migration is run
- Check RLS policies are set correctly
- Verify Supabase URL and keys

## 📝 Client Feedback Collection

You can create a simple feedback form or use:

1. **Google Forms**: Create a feedback form and share the link
2. **Email**: Ask client to email feedback
3. **Comments**: Add a feedback button in the app
4. **Analytics**: Use Vercel Analytics to see what pages they visit

## 🎨 Preview Deployments

Vercel creates preview deployments for each Git branch/PR:
- Great for testing before production
- Share preview URLs with client for review
- Merge to main branch to deploy to production

## 🔐 Security Notes

- Never commit `.env.local` to Git
- Use Vercel's environment variables (not hardcoded)
- Keep Supabase service role key secret
- Enable RLS policies in Supabase

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review browser console errors
3. Verify environment variables
4. Check Supabase dashboard for database issues

---

**Your deployment URL will look like**: `https://mongers-rugby-club.vercel.app`

Share this link with your client once deployed! 🚀

