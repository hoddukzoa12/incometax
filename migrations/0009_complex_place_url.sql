ALTER TABLE complex ADD COLUMN place_url TEXT;
ALTER TABLE complex_staging ADD COLUMN place_url TEXT;

CREATE TABLE complex_place_url_checkpoint (
  complex_id TEXT PRIMARY KEY REFERENCES complex(complex_id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN (
      'filled', 'noResult', 'tooFar', 'candidateMismatch',
      'missingCoordinates', 'responseError'
    )),
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  api_attempt_count INTEGER NOT NULL CHECK (api_attempt_count >= 0),
  reason TEXT,
  attempted_at TEXT NOT NULL
) STRICT;

CREATE INDEX complex_place_url_checkpoint_status_idx
  ON complex_place_url_checkpoint (status, attempted_at, complex_id);
