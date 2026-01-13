-- Create a function to update user profile that bypasses schema cache issues
-- This function handles birth_date updates even if the schema cache hasn't refreshed

CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_emergency_contact TEXT,
  p_emergency_phone TEXT,
  p_birth_date DATE
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  unique_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  birth_date DATE,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_profile RECORD;
BEGIN
  -- Build dynamic update query
  -- Only update fields that are provided (not NULL)
  UPDATE user_profiles
  SET
    name = CASE WHEN p_name IS NOT NULL THEN p_name ELSE name END,
    phone = CASE WHEN p_phone IS NOT NULL THEN p_phone ELSE phone END,
    emergency_contact = CASE WHEN p_emergency_contact IS NOT NULL THEN p_emergency_contact ELSE emergency_contact END,
    emergency_phone = CASE WHEN p_emergency_phone IS NOT NULL THEN p_emergency_phone ELSE emergency_phone END,
    birth_date = CASE WHEN p_birth_date IS NOT NULL THEN p_birth_date 
                      WHEN p_birth_date IS NULL AND (SELECT birth_date FROM user_profiles WHERE user_id = p_user_id) IS NOT NULL 
                      THEN NULL 
                      ELSE birth_date END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING * INTO v_updated_profile;
  
  -- Return the updated profile
  RETURN QUERY SELECT 
    v_updated_profile.id,
    v_updated_profile.user_id,
    v_updated_profile.unique_id,
    v_updated_profile.name,
    v_updated_profile.email,
    v_updated_profile.phone,
    v_updated_profile.role,
    v_updated_profile.status,
    v_updated_profile.emergency_contact,
    v_updated_profile.emergency_phone,
    v_updated_profile.birth_date,
    v_updated_profile.profile_picture_url,
    v_updated_profile.created_at,
    v_updated_profile.updated_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_user_profile IS 'Updates user profile including birth_date, bypassing schema cache issues';
