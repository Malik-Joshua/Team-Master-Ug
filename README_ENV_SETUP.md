# Environment Variables Setup

## Required Environment Variables

For the admin API routes to work correctly, you need to set the following environment variable in your deployment:

### `SUPABASE_SERVICE_ROLE_KEY`

This is the service role key from your Supabase project. It's required for admin API routes to bypass Row Level Security (RLS) policies.

**How to find it:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "service_role" key (NOT the anon key)

**Where to set it:**
- **Vercel**: Go to your project settings → Environment Variables → Add `SUPABASE_SERVICE_ROLE_KEY`
- **Other platforms**: Add it to your environment variables configuration

**Important:** 
- Never commit this key to your repository
- This key has admin privileges and bypasses RLS
- Only use it in server-side code (API routes)

## Other Required Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Verifying Setup

After setting the environment variables, the admin API routes should work:
- `/api/admin/statistics` - Admin dashboard statistics
- `/api/admin/players` - All players list
- `/api/admin/inventory` - All inventory items
- `/api/admin/performance` - Performance data

If you see 500 errors, check:
1. Environment variables are set correctly
2. The service role key is valid
3. Check server logs for detailed error messages


