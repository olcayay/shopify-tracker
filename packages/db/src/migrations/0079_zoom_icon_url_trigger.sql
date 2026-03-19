-- Trigger to auto-encode Zoom CDN icon URLs on insert/update.
-- Ensures the S3 key is always URL-encoded (slashes → %2F).

CREATE OR REPLACE FUNCTION fix_zoom_icon_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.platform = 'zoom'
    AND NEW.icon_url IS NOT NULL
    AND NEW.icon_url LIKE 'https://marketplacecontent-cf.zoom.us/%'
    AND NEW.icon_url NOT LIKE 'https://marketplacecontent-cf.zoom.us/%' || '%2F%'
  THEN
    NEW.icon_url := 'https://marketplacecontent-cf.zoom.us/' || replace(
      '/' || regexp_replace(
        replace(NEW.icon_url, 'https://marketplacecontent-cf.zoom.us', ''),
        '^/+', ''
      ),
      '/', '%2F'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fix_zoom_icon_url ON apps;
CREATE TRIGGER trg_fix_zoom_icon_url
  BEFORE INSERT OR UPDATE OF icon_url ON apps
  FOR EACH ROW
  EXECUTE FUNCTION fix_zoom_icon_url();
