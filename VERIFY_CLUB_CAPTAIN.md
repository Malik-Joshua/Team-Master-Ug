# Verify Club Captain Setup for Malik Amos

## Step 1: Check if Club Captain Profile Exists

Run this SQL in Supabase SQL Editor to find the club captain profile:

```sql
-- Find club captain profiles
SELECT 
  user_id,
  name,
  email,
  role,
  linked_player_id,
  created_at
FROM user_profiles
WHERE role = 'club_captain'
ORDER BY created_at DESC;
```

## Step 2: Find Malik Amos Player Account

```sql
-- Find Malik Amos player account
SELECT 
  user_id,
  name,
  email,
  role,
  created_at
FROM user_profiles
WHERE role = 'player'
  AND (name ILIKE '%Malik%' OR name ILIKE '%Amos%' OR email ILIKE '%malik%' OR email ILIKE '%amos%')
ORDER BY created_at DESC;
```

## Step 3: Verify the Link

```sql
-- Check if club captain is linked to player
SELECT 
  cc.user_id as club_captain_user_id,
  cc.name as club_captain_name,
  cc.email as club_captain_email,
  cc.linked_player_id,
  p.user_id as player_user_id,
  p.name as player_name,
  p.email as player_email
FROM user_profiles cc
LEFT JOIN user_profiles p ON p.user_id = cc.linked_player_id
WHERE cc.role = 'club_captain'
  AND (cc.name ILIKE '%Malik%' OR cc.name ILIKE '%Amos%' OR p.name ILIKE '%Malik%' OR p.name ILIKE '%Amos%');
```

## Step 4: If Link is Missing, Fix It

If the club captain profile exists but `linked_player_id` is NULL or incorrect:

```sql
-- Replace <player_user_id> with the actual player user_id from Step 2
-- Replace <club_captain_user_id> with the actual club captain user_id from Step 1

UPDATE user_profiles
SET linked_player_id = '<player_user_id>'
WHERE user_id = '<club_captain_user_id>'
  AND role = 'club_captain';

  
```

## Step 5: Test the Connection

After fixing, have Malik Amos:
1. Log out completely
2. Log back in with their **player account** (not club captain account)
3. They should be automatically redirected to `/dashboard/club-captain`

## Troubleshooting

### If club captain profile doesn't exist:
- The admin promotion might have failed
- Check browser console for errors when clicking the Award button
- Check Supabase logs for API errors

### If link exists but dashboard doesn't redirect:
- Check browser console for errors
- Verify RLS policies allow reading club_captain profiles
- Check if the query in `app/dashboard/page.tsx` line 99-104 is working

### If RLS is blocking:
Run this to check RLS policies:

```sql
-- Check RLS policies on user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles';
```
