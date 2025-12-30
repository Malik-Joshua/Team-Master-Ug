-- Fix training_attendance constraint to ensure it matches expected values
-- The constraint should allow: 'P', 'A', 'X', 'I'

-- Drop the existing constraint if it exists (try multiple possible names)
ALTER TABLE training_attendance 
DROP CONSTRAINT IF EXISTS training_attendance_attendance_status_check;

-- Also try to drop any constraint that might have been created inline
-- Note: This might fail if the constraint doesn't exist, which is fine
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find any constraint on attendance_status
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'training_attendance'::regclass 
    AND pg_get_constraintdef(oid) LIKE '%attendance_status%';
    
    IF constraint_name IS NOT NULL AND constraint_name != 'training_attendance_attendance_status_check' THEN
        EXECUTE format('ALTER TABLE training_attendance DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if constraint doesn't exist
        NULL;
END $$;

-- Add the correct constraint with explicit single-character values
-- Using explicit OR conditions to be absolutely clear
ALTER TABLE training_attendance
ADD CONSTRAINT training_attendance_attendance_status_check 
CHECK (
    attendance_status = 'P' OR 
    attendance_status = 'A' OR 
    attendance_status = 'X' OR 
    attendance_status = 'I'
);

