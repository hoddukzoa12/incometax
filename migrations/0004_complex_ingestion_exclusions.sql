ALTER TABLE complex_refresh_state
  ADD COLUMN excluded_records_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(excluded_records_json));
