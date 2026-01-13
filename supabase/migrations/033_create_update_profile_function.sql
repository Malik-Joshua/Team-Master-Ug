-- Create a function to update user profile that bypasses schema cache issues
-- This function handles birth_date updates even if the schema cache hasn't refreshed

CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_emergency_phone TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL
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
  v_current_profile RECORD;
BEGIN
  -- Get current profile to check what fields exist
  SELECT * INTO v_current_profile FROM user_profiles WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Build dynamic update query
  -- Update only fields that are explicitly provided (not NULL)
  -- Use COALESCE to keep existing value if parameter is NULL
  UPDATE user_profiles
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    emergency_contact = COALESCE(p_emergency_contact, emergency_contact),
    emergency_phone = COALESCE(p_emergency_phone, emergency_phone),
    birth_date = COALESCE(p_birth_date, birth_date),
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
-- Note: Function signature includes DEFAULT NULL for optional parameters
GRANT EXECUTE ON FUNCTION update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_user_profile IS 'Updates user profile including birth_date, bypassing schema cache issues';
