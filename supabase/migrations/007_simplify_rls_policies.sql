-- Migration: Simplify RLS policies to completely avoid recursion
-- This is a more aggressive fix that ensures no recursion can occur

-- Drop ALL existing policies on user_profiles to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins and coaches can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_admin_or_coach();

-- Create a simple function to get user role without RLS recursion
-- Uses SECURITY DEFINER to bypass RLS when checking roles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Policy 1: Users can always view their own profile (no recursion)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Admins/coaches can view all profiles (uses function to avoid recursion)
CREATE POLICY "Admins and coaches can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    get_user_role() IN ('admin', 'coach', 'data_admin')
  );

-- Policy 3: Users can update their own profile (no recursion)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy 4: Admins can update any profile (uses function to avoid recursion)
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  USING (get_user_role() = 'admin');

-- Policy 5: Users can create their own profile (no recursion)
CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

