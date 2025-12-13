-- Migration: Simple RLS fix - Minimal policies to avoid recursion
-- This is the simplest approach that guarantees no recursion

-- Drop ALL existing policies and functions
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

DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_admin_or_coach();
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.get_user_role_safe();
DROP FUNCTION IF EXISTS public.get_user_role_from_metadata();
DROP FUNCTION IF EXISTS public.check_user_role(TEXT);
DROP FUNCTION IF EXISTS public.is_admin_or_coach_role();

-- SIMPLEST SOLUTION: Only allow users to view/update their own profile
-- Admin/coach access will be handled via API routes with service role
-- This completely eliminates any possibility of recursion

-- Policy 1: Users can view their own profile (NO recursion - only checks auth.uid())
CREATE POLICY "users_view_own_profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can update their own profile (NO recursion)
CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can create their own profile (NO recursion)
CREATE POLICY "users_create_own_profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- That's it! No admin/coach policies that query user_profiles = no recursion
-- Admin and coach access to all profiles should be done via:
-- 1. API routes using service role key (bypasses RLS)
-- 2. Or create separate admin functions that use SECURITY DEFINER

