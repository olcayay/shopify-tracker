-- Fix Zoom app icon URLs: the CDN requires the S3 key to be URL-encoded
-- (slashes as %2F) rather than used as path segments.
-- Transform: https://...zoom.us/a/b/app/c/d.png → https://...zoom.us/%2Fa%2Fb%2Fapp%2Fc%2Fd.png
-- Idempotent: decodes any existing %2F first, strips leading slashes, then re-encodes.
UPDATE apps
SET icon_url = 'https://marketplacecontent-cf.zoom.us/' || replace(
  '/' || regexp_replace(
    replace(
      replace(icon_url, 'https://marketplacecontent-cf.zoom.us', ''),
      '%2F', '/'
    ),
    '^/+', ''
  ),
  '/', '%2F'
)
WHERE platform = 'zoom'
  AND icon_url IS NOT NULL
  AND icon_url LIKE 'https://marketplacecontent-cf.zoom.us%';
