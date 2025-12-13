-- Migration: Complete RLS fix - Remove all recursive checks
-- This migration completely eliminates recursion by restructuring policies

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins and coaches can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;

-- Drop all functions
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_admin_or_coach();
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.get_user_role_safe();
DROP FUNCTION IF EXISTS public.get_user_role_from_metadata();

-- Create a helper function that truly bypasses RLS
-- This function will be used ONLY for policy evaluation
CREATE OR REPLACE FUNCTION public.check_user_role(check_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- This query bypasses RLS because function is SECURITY DEFINER
  SELECT role INTO user_role
  FROM user_profiles
  WHERE user_id = auth.uid();
  
  RETURN user_role = check_role OR user_role IN ('admin', 'coach', 'data_admin');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_role(TEXT) TO authenticated;

-- SIMPLE POLICY 1: Users can view their own profile
-- This has NO recursion because it only checks auth.uid()
CREATE POLICY "users_view_own_profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- SIMPLE POLICY 2: Admins/coaches can view all (separate policy, no overlap)
-- This uses a function that bypasses RLS
CREATE POLICY "admins_view_all_profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'coach', 'data_admin')
    )
  );

-- Wait, that still has recursion. Let me fix it properly:
-- Drop the problematic policy
DROP POLICY IF EXISTS "admins_view_all_profiles" ON user_profiles;

-- Use the function approach but make it simpler
CREATE POLICY "admins_view_all_profiles"
  ON user_profiles FOR SELECT
  USING (check_user_role('admin') OR check_user_role('coach') OR check_user_role('data_admin'));

-- Actually, even that might have issues. Let me use the simplest possible approach:
-- Just allow users to see their own profile, and use a database trigger or API route for admin access
DROP POLICY IF EXISTS "admins_view_all_profiles" ON user_profiles;

-- For now, let's just allow users to see their own profile
-- Admin/coach access can be handled via API routes with service role
-- This completely eliminates recursion

-- UPDATE policy: Users can update own
CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT policy: Users can create own
CREATE POLICY "users_create_own_profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add a policy for admins/coaches to view all profiles
-- This uses a SECURITY DEFINER function that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin_or_coach_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- This bypasses RLS because function is SECURITY DEFINER
  PERFORM role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1 INTO user_role;
  RETURN user_role IN ('admin', 'coach', 'data_admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_coach_role() TO authenticated;

CREATE POLICY "admins_view_all_profiles"
  ON user_profiles FOR SELECT
  USING (is_admin_or_coach_role());

