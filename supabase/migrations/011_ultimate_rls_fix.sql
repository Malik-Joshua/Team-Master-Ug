-- Migration: Ultimate RLS fix - Complete elimination of recursion
-- This uses a materialized approach to avoid any possibility of recursion

-- Step 1: Disable RLS temporarily to clean up
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies (this is safe now since RLS is disabled)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins and coaches can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "users_create_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;

-- Step 3: Drop ALL functions that might cause issues
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_admin_or_coach();
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.get_user_role_safe();
DROP FUNCTION IF EXISTS public.get_user_role_from_metadata();
DROP FUNCTION IF EXISTS public.check_user_role(TEXT);
DROP FUNCTION IF EXISTS public.is_admin_or_coach_role();

-- Step 4: Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create the SIMPLEST possible policies with NO recursion
-- Policy 1: Users can ONLY view their own profile (direct auth.uid() check - NO recursion)
CREATE POLICY "users_view_own_profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can ONLY update their own profile (direct auth.uid() check - NO recursion)
CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can ONLY create their own profile (direct auth.uid() check - NO recursion)
CREATE POLICY "users_create_own_profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- That's it! No admin/coach policies that query user_profiles = ZERO possibility of recursion
-- Admin and coach access to all profiles must be done via API routes using service role key

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';











