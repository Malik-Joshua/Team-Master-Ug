# Fix Club Captain Link

## Problem
The player account (user_id: `db704f7e-e891-4a25-a651-e078f01112b0`) doesn't have a linked club captain account.

## Solution

### Step 1: Verify the Club Captain Account Exists

Run this SQL in Supabase SQL Editor to find the club captain account for AMOS MALIK:

```sql
SELECT 
  user_id,
  name,
  email,
  role,
  linked_player_id,
  created_at
FROM user_profiles
WHERE name ILIKE '%AMOS%' 
   OR name ILIKE '%MALIK%'
   OR email ILIKE '%amos%'
   OR email ILIKE '%malik%'
ORDER BY created_at DESC;
```

### Step 2: Check if Link is Missing

Run this to see if the club captain account exists but isn't linked:

```sql
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
  AND (cc.name ILIKE '%AMOS%' OR cc.name ILIKE '%MALIK%');
```

### Step 3: Fix the Link

If the club captain account exists but `linked_player_id` is NULL or incorrect, update it:

```sql
-- Replace these values with the actual IDs from Step 1:
-- club_captain_user_id: The user_id of the club captain account
-- player_user_id: db704f7e-e891-4a25-a651-e078f01112b0

UPDATE user_profiles
SET linked_player_id = 'db704f7e-e891-4a25-a651-e078f01112b0'
WHERE role = 'club_captain'
  AND user_id = '<club_captain_user_id>'
  AND (name ILIKE '%AMOS%' OR name ILIKE '%MALIK%');
```

### Step 4: Verify the Fix

```sql
SELECT 
  cc.name as club_captain_name,
  cc.user_id as club_captain_id,
  cc.linked_player_id,
  p.name as player_name,
  p.user_id as player_id
FROM user_profiles cc
JOIN user_profiles p ON p.user_id = cc.linked_player_id
WHERE cc.role = 'club_captain'
  AND cc.linked_player_id = 'db704f7e-e891-4a25-a651-e078f01112b0';
```

This should return the linked accounts.

### Alternative: Create the Link if Club Captain Account Exists

If the club captain account exists but wasn't linked during signup:

```sql
-- First, find the club captain account
SELECT user_id, name, email 
FROM user_profiles 
WHERE role = 'club_captain' 
  AND (name ILIKE '%AMOS%' OR name ILIKE '%MALIK%');

-- Then update it (replace <club_captain_user_id> with the actual ID)
UPDATE user_profiles
SET linked_player_id = 'db704f7e-e891-4a25-a651-e078f01112b0'
WHERE user_id = '<club_captain_user_id>'
  AND role = 'club_captain';
```

## After Fixing

1. Have AMOS MALIK log out and log back in with their **player account**
2. The system should now detect the linked club captain account
3. They should be redirected to the club captain dashboard
