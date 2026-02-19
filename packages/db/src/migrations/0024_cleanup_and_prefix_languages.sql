-- Clean up languages with "and " prefix (e.g. "and Dutch" → "Dutch")
-- Also clean up integrations with the same issue
UPDATE app_snapshots
SET languages = (
  SELECT jsonb_agg(
    CASE
      WHEN elem #>> '{}' ~* '^and\s+' THEN regexp_replace(elem #>> '{}', '^and\s+', '', 'i')
      ELSE elem #>> '{}'
    END
  )
  FROM jsonb_array_elements(languages) AS elem
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(languages) AS elem
  WHERE elem #>> '{}' ~* '^and\s+'
);

UPDATE app_snapshots
SET integrations = (
  SELECT jsonb_agg(
    CASE
      WHEN elem #>> '{}' ~* '^and\s+' THEN regexp_replace(elem #>> '{}', '^and\s+', '', 'i')
      ELSE elem #>> '{}'
    END
  )
  FROM jsonb_array_elements(integrations) AS elem
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(integrations) AS elem
  WHERE elem #>> '{}' ~* '^and\s+'
);
