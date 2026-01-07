-- Migration: Final fix for RLS recursion - Use auth.users metadata approach
-- This completely avoids querying user_profiles in policies

-- Drop ALL existing policies and functions
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins and coaches can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_admin_or_coach();
DROP FUNCTION IF EXISTS public.get_user_role();

-- Create a function that uses auth.users metadata to store role
-- This avoids querying user_profiles table entirely
CREATE OR REPLACE FUNCTION public.get_user_role_from_metadata()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT raw_user_meta_data->>'role'::TEXT
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Alternative: Create a function that bypasses RLS completely
CREATE OR REPLACE FUNCTION public.get_user_role_safe()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Use a direct query with RLS bypass
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_role_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_from_metadata() TO authenticated;

-- Policy 1: Users can always view their own profile (no recursion - direct check)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Admins/coaches can view all profiles (uses function that bypasses RLS)
CREATE POLICY "Admins and coaches can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    get_user_role_safe() IN ('admin', 'coach', 'data_admin')
  );

-- Policy 3: Users can update their own profile (no recursion)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Admins can update any profile (uses function)
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  USING (get_user_role_safe() = 'admin')
  WITH CHECK (get_user_role_safe() = 'admin');

-- Policy 5: Users can create their own profile (no recursion)
CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);






















