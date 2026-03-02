UPDATE "hub_submissions"
SET "model" = regexp_replace("model", '^.*/', '')
WHERE "model" LIKE '%/%';
