-- Add support for multiple links in performance_resources table
-- Change attachment_url to links (JSONB array) to support multiple links

-- Add new links column as JSONB array
ALTER TABLE performance_resources
ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;

-- Migrate existing attachment_url data to links array
UPDATE performance_resources
SET links = CASE
  WHEN attachment_url IS NOT NULL AND attachment_url != '' THEN
    jsonb_build_array(jsonb_build_object('url', attachment_url, 'label', 'Attachment'))
  ELSE '[]'::jsonb
END
WHERE links = '[]'::jsonb OR links IS NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_performance_resources_links ON performance_resources USING GIN (links);

-- Add comment
COMMENT ON COLUMN performance_resources.links IS 'Array of link objects with url and label properties. Format: [{"url": "https://...", "label": "Link Name"}]';

-- Keep attachment_url for backward compatibility but it's now deprecated
-- Users should use links array instead

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
