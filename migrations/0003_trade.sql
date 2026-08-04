CREATE TABLE trade (
  trade_id TEXT PRIMARY KEY,
  complex_id TEXT NOT NULL REFERENCES complex(complex_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('apt', 'rowhouse', 'officetel')),
  match_level TEXT NOT NULL CHECK (match_level IN ('lot', 'candidate')),
  deal_date TEXT NOT NULL CHECK (length(deal_date) = 10),
  deal_amount INTEGER NOT NULL CHECK (deal_amount > 0),
  exclusive_area REAL NOT NULL CHECK (exclusive_area > 0),
  floor INTEGER,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX trade_complex_deal_date_idx
  ON trade (complex_id, deal_date DESC);

CREATE TABLE trade_staging (
  refresh_id TEXT NOT NULL,
  trade_id TEXT NOT NULL,
  complex_id TEXT NOT NULL REFERENCES complex(complex_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('apt', 'rowhouse', 'officetel')),
  legal_district_code TEXT NOT NULL CHECK (length(legal_district_code) = 5),
  deal_year_month TEXT NOT NULL CHECK (length(deal_year_month) = 6),
  match_level TEXT NOT NULL CHECK (match_level IN ('lot', 'candidate')),
  deal_date TEXT NOT NULL CHECK (length(deal_date) = 10),
  deal_amount INTEGER NOT NULL CHECK (deal_amount > 0),
  exclusive_area REAL NOT NULL CHECK (exclusive_area > 0),
  floor INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (refresh_id, trade_id)
) STRICT;

CREATE INDEX trade_staging_dataset_idx
  ON trade_staging (refresh_id, source, legal_district_code, deal_year_month);

CREATE TABLE trade_refresh_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  refresh_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('inProgress', 'completed')),
  cutoff_date TEXT NOT NULL CHECK (length(cutoff_date) = 10),
  window_end_date TEXT NOT NULL CHECK (length(window_end_date) = 10),
  legal_district_codes_json TEXT NOT NULL,
  deal_year_months_json TEXT NOT NULL,
  dataset_count INTEGER NOT NULL CHECK (dataset_count > 0),
  started_at TEXT NOT NULL,
  completed_at TEXT
) STRICT;

CREATE TABLE trade_dataset_checkpoint (
  refresh_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('apt', 'rowhouse', 'officetel')),
  legal_district_code TEXT NOT NULL CHECK (length(legal_district_code) = 5),
  deal_year_month TEXT NOT NULL CHECK (length(deal_year_month) = 6),
  raw_count INTEGER NOT NULL CHECK (raw_count >= 0),
  canceled_count INTEGER NOT NULL CHECK (canceled_count >= 0),
  duplicate_count INTEGER NOT NULL CHECK (duplicate_count >= 0),
  outside_window_count INTEGER NOT NULL CHECK (outside_window_count >= 0),
  active_count INTEGER NOT NULL CHECK (active_count >= 0),
  matched_count INTEGER NOT NULL CHECK (matched_count >= 0),
  lot_count INTEGER NOT NULL CHECK (lot_count >= 0),
  candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
  ambiguous_count INTEGER NOT NULL CHECK (ambiguous_count >= 0),
  unmatched_count INTEGER NOT NULL CHECK (unmatched_count >= 0),
  completed_at TEXT NOT NULL,
  PRIMARY KEY (refresh_id, source, legal_district_code, deal_year_month)
) STRICT;

-- A complex disappearing from the validated master cascades its staged trades.
-- Invalidate the whole source/district/month checkpoint so the resumable trade
-- refresh fetches that dataset again instead of activating a partial slice.
CREATE TRIGGER trade_staging_delete_checkpoint
AFTER DELETE ON trade_staging
BEGIN
  DELETE FROM trade_dataset_checkpoint
   WHERE refresh_id = OLD.refresh_id
     AND source = OLD.source
     AND legal_district_code = OLD.legal_district_code
     AND deal_year_month = OLD.deal_year_month;
END;
