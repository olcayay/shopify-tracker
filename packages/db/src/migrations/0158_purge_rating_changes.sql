-- Purge false change records for averageRating and ratingCount.
-- These fields fluctuate naturally with every new review and should never
-- have been tracked as listing changes. See PLA-1130.
DELETE FROM app_field_changes
WHERE field IN ('averageRating', 'ratingCount');
