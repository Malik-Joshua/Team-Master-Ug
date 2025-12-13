-- Migration: Final fix - Completely eliminate recursion by using ONLY direct auth.uid() checks
-- This is the nuclear option - removes ALL policies that could cause recursion

-- STEP 1: Disable RLS completely
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop EVERYTHING that could cause recursion
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON user_profiles';
    END LOOP;
    
    -- Drop all functions that query user_profiles
    DROP FUNCTION IF EXISTS get_user_role() CASCADE;
    DROP FUNCTION IF EXISTS is_admin_or_coach() CASCADE;
    DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
    DROP FUNCTION IF EXISTS public.get_user_role_safe() CASCADE;
    DROP FUNCTION IF EXISTS public.get_user_role_from_metadata() CASCADE;
    DROP FUNCTION IF EXISTS public.check_user_role(TEXT) CASCADE;
    DROP FUNCTION IF EXISTS public.is_admin_or_coach_role() CASCADE;
END $$;

-- STEP 3: Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create ONLY the simplest policies with ZERO possibility of recursion
-- These policies ONLY check auth.uid() - they NEVER query user_profiles

-- Policy 1: Users can view ONLY their own profile
CREATE POLICY "users_select_own"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can update ONLY their own profile  
CREATE POLICY "users_update_own"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can insert ONLY their own profile
CREATE POLICY "users_insert_own"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- That's it! No admin policies, no coach policies, no functions
-- Admin and coach access MUST use API routes with service role key
-- This guarantees ZERO recursion because policies never query user_profiles

-- Verify: List all policies on user_profiles
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual::text as using_expression,
    with_check::text as with_check_expression
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;

