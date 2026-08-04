-- Kakao batch keyword lookup supplies addresses/coordinates before the K-apt
-- detail quota can backfill these nullable facts. Preserve existing values.
ALTER TABLE complex RENAME COLUMN building_count TO building_count_required;
ALTER TABLE complex ADD COLUMN building_count INTEGER CHECK (building_count >= 0);
UPDATE complex SET building_count = building_count_required;
ALTER TABLE complex DROP COLUMN building_count_required;

ALTER TABLE complex RENAME COLUMN household_count TO household_count_required;
ALTER TABLE complex ADD COLUMN household_count INTEGER CHECK (household_count >= 0);
UPDATE complex SET household_count = household_count_required;
ALTER TABLE complex DROP COLUMN household_count_required;

ALTER TABLE complex
  ADD COLUMN lookup_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (lookup_status IN ('pending', 'matched', 'notFound', 'rejected'));
ALTER TABLE complex ADD COLUMN backfill_reason TEXT;

ALTER TABLE complex_staging
  RENAME COLUMN building_count TO building_count_required;
ALTER TABLE complex_staging
  ADD COLUMN building_count INTEGER CHECK (building_count >= 0);
UPDATE complex_staging SET building_count = building_count_required;
ALTER TABLE complex_staging DROP COLUMN building_count_required;

ALTER TABLE complex_staging
  RENAME COLUMN household_count TO household_count_required;
ALTER TABLE complex_staging
  ADD COLUMN household_count INTEGER CHECK (household_count >= 0);
UPDATE complex_staging SET household_count = household_count_required;
ALTER TABLE complex_staging DROP COLUMN household_count_required;

ALTER TABLE complex_staging
  ADD COLUMN lookup_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (lookup_status IN ('pending', 'matched', 'notFound', 'rejected'));
ALTER TABLE complex_staging ADD COLUMN backfill_reason TEXT;
