-- Migration: Verify current state and fix any remaining recursion issues
-- Run this to see what policies are currently active

-- First, let's see what we have
SELECT 
    'Current Policies:' as info,
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual::text as using_clause
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Check for any functions that might query user_profiles
SELECT 
    'Functions that might cause issues:' as info,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%user_profiles%'
ORDER BY routine_name;

-- Now run the fix from migration 012
-- This will disable RLS, drop everything, and recreate only simple policies












