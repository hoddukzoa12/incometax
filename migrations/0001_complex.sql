CREATE TABLE complex (
  complex_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_address TEXT NOT NULL,
  road_address TEXT,
  legal_dong_code TEXT NOT NULL CHECK (length(legal_dong_code) = 10),
  approval_date TEXT,
  building_count INTEGER NOT NULL CHECK (building_count >= 0),
  household_count INTEGER NOT NULL CHECK (household_count >= 0),
  lat REAL CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng REAL CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  updated_at TEXT NOT NULL,
  CHECK ((lat IS NULL) = (lng IS NULL))
) STRICT;

CREATE INDEX complex_lat_lng_idx ON complex (lat, lng);
CREATE INDEX complex_legal_dong_code_idx ON complex (legal_dong_code);

CREATE TABLE complex_staging (
  complex_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_address TEXT NOT NULL,
  road_address TEXT,
  legal_dong_code TEXT NOT NULL CHECK (length(legal_dong_code) = 10),
  approval_date TEXT,
  building_count INTEGER NOT NULL CHECK (building_count >= 0),
  household_count INTEGER NOT NULL CHECK (household_count >= 0),
  lat REAL CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng REAL CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  updated_at TEXT NOT NULL,
  CHECK ((lat IS NULL) = (lng IS NULL))
) STRICT;

CREATE TABLE complex_refresh_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  verification_observed_at TEXT NOT NULL,
  expected_count INTEGER NOT NULL CHECK (expected_count > 0),
  started_at TEXT NOT NULL
) STRICT;
