-- Delete false appCardSubtitle changes caused by sponsored listing descriptions
-- Sponsored listings show "The app developer paid to promote this listing..." as subtitle
-- which differs from the organic subtitle, causing false change detections.
DELETE FROM app_field_changes
WHERE field = 'appCardSubtitle'
  AND (
    old_value ILIKE '%app developer paid to promote%'
    OR new_value ILIKE '%app developer paid to promote%'
    OR old_value ILIKE '%this ad is based on%'
    OR new_value ILIKE '%this ad is based on%'
  );
