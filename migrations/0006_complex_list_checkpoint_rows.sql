-- Restart the list-only checkpoint after replacing the oversized JSON blob.
-- Existing complex_staging rows remain available for lookup resume.
CREATE TABLE complex_list_checkpoint (
  page INTEGER NOT NULL CHECK (page > 0),
  complex_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_dong_code TEXT NOT NULL CHECK (length(legal_dong_code) = 10),
  province TEXT,
  district TEXT,
  legal_dong TEXT,
  ri TEXT,
  PRIMARY KEY (page, complex_id)
) STRICT;

UPDATE complex_refresh_state SET list_fields_json = '[]';

ALTER TABLE complex_refresh_state DROP COLUMN list_records_json;
ALTER TABLE complex_refresh_state DROP COLUMN next_list_page;
