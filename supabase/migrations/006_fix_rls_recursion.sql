-- Migration: Fix RLS recursion issues in user_profiles policies
-- The issue: Policies that check user_profiles while querying user_profiles cause infinite recursion

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Admins and coaches can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Create a security definer function that bypasses RLS to check user role
-- This avoids recursion because the function runs with elevated privileges
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- Recreate the SELECT policy - users can see their own profile OR if they're admin/coach
CREATE POLICY "Admins and coaches can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    auth.uid() = user_id OR  -- Users can always see their own profile
    get_user_role() IN ('admin', 'coach', 'data_admin')  -- Admins/coaches can see all
  );

-- Recreate the UPDATE policy - users can update their own OR admins can update any
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  USING (
    auth.uid() = user_id OR  -- Users can update their own profile
    get_user_role() = 'admin'  -- Admins can update any profile
  );
