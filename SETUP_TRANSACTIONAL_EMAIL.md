# Setup Transactional Email Service (Recommended)

## Why Not Gmail?

Gmail SMTP is designed for **personal email**, not **transactional emails** (like confirmation emails). Using Gmail can cause:
- ❌ Rate limiting (only ~100 emails/day)
- ❌ Emails marked as spam
- ❌ Account restrictions
- ❌ Poor deliverability

## Recommended Solutions

### Option 1: SendGrid (Easiest - Free Tier Available)

**Free Tier:** 100 emails/day forever

#### Setup Steps:

1. **Sign up for SendGrid:**
   - Go to https://sendgrid.com
   - Sign up for free account
   - Verify your email

2. **Create API Key:**
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Name it: "Supabase TeamMaster"
   - Select "Full Access" or "Restricted Access" with Mail Send permissions
   - Copy the API key (you'll only see it once!)

3. **Configure in Supabase:**
   - Go to Supabase Dashboard → Authentication → Settings → SMTP Settings
   - Enable "Custom SMTP"
   - Enter:
     - **SMTP Host:** `smtp.sendgrid.net`
     - **SMTP Port:** `587`
     - **SMTP User:** `apikey` (literally the word "apikey")
     - **SMTP Password:** Your SendGrid API key (the one you copied)
     - **Sender Email:** Your verified email in SendGrid
     - **Sender Name:** "TeamMaster" (or your app name)
   - Save settings

4. **Verify Sender:**
   - In SendGrid, go to Settings → Sender Authentication
   - Verify your sender email address
   - This improves deliverability

### Option 2: AWS SES (Most Reliable - Production Ready)

**Free Tier:** 62,000 emails/month for first year (if on EC2)

#### Setup Steps:

1. **Create AWS Account** (if you don't have one)
2. **Go to AWS SES Console**
3. **Verify Email Domain or Email Address**
4. **Request Production Access** (if needed)
5. **Create SMTP Credentials:**
   - Go to SMTP Settings
   - Click "Create SMTP Credentials"
   - Save the username and password

6. **Configure in Supabase:**
   - **SMTP Host:** Your SES SMTP endpoint (e.g., `email-smtp.us-east-1.amazonaws.com`)
   - **SMTP Port:** `587`
   - **SMTP User:** Your SES SMTP username
   - **SMTP Password:** Your SES SMTP password
   - **Sender Email:** Your verified email/domain
   - **Sender Name:** "TeamMaster"

### Option 3: Mailgun (Developer Friendly)

**Free Tier:** 5,000 emails/month for 3 months, then 1,000/month

#### Setup Steps:

1. **Sign up at mailgun.com**
2. **Verify your domain** (or use sandbox domain for testing)
3. **Get SMTP credentials** from Settings → Sending → SMTP
4. **Configure in Supabase** with Mailgun SMTP settings

### Option 4: Postmark (Best Deliverability)

**Paid:** $15/month for 10,000 emails (but excellent deliverability)

## Quick Comparison

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **SendGrid** | 100/day | Getting started, small apps |
| **AWS SES** | 62k/month* | Production, high volume |
| **Mailgun** | 1k/month | Developers, APIs |
| **Postmark** | Paid | Best deliverability |

*First year only, then pay-as-you-go

## Recommended: SendGrid for Your Use Case

For your TeamMaster app, **SendGrid is the best choice** because:
- ✅ Free tier (100 emails/day) is enough for most teams
- ✅ Easy setup
- ✅ Good deliverability
- ✅ No credit card required
- ✅ Can upgrade later if needed

## Setup SendGrid Now

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com/free/
2. Sign up with your email
3. Verify your email address

### Step 2: Create API Key
1. In SendGrid dashboard, go to **Settings → API Keys**
2. Click **"Create API Key"**
3. Name: `Supabase TeamMaster`
4. Permissions: **"Full Access"** (or "Restricted Access" with Mail Send)
5. **Copy the API key immediately** (you won't see it again!)

### Step 3: Verify Sender
1. Go to **Settings → Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Enter your email and verify it
4. This improves email deliverability

### Step 4: Configure in Supabase
1. Go to **Supabase Dashboard → Authentication → Settings → SMTP Settings**
2. Enable **"Custom SMTP"**
3. Enter:
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Password: [Your SendGrid API Key]
   Sender Email: [Your verified email]
   Sender Name: TeamMaster
   ```
4. **Save settings**

### Step 5: Test
1. Try signing up a new user
2. Check if confirmation email arrives
3. Check SendGrid dashboard for sending stats

## After Setup

1. **Remove Gmail SMTP** - Disable it in Supabase
2. **Test signup** - Try creating a new account
3. **Monitor SendGrid** - Check dashboard for delivery stats
4. **Check spam folder** - First emails might go to spam until reputation builds

## Troubleshooting

### Emails Still Not Sending?
1. **Check SendGrid Activity** - See if emails are being sent
2. **Verify API Key** - Make sure it's correct
3. **Check Sender Verification** - Must verify sender email
4. **Check Supabase Logs** - Look for SMTP errors

### Rate Limits?
- SendGrid free tier: 100 emails/day
- If you need more, upgrade to paid plan

### Emails Going to Spam?
- Verify sender in SendGrid
- Use a custom domain (advanced)
- Wait for reputation to build

## Cost Comparison

- **Gmail (Personal):** Free but unreliable for transactional
- **SendGrid:** Free (100/day) or $19.95/month (40k emails)
- **AWS SES:** $0.10 per 1,000 emails (very cheap)
- **Mailgun:** Free (1k/month) or $35/month (50k emails)

## Recommendation

**Start with SendGrid** - It's free, easy to set up, and perfect for your needs. You can always switch to AWS SES later if you need more volume.
