ALTER TABLE complex_refresh_state
  ADD COLUMN next_list_page INTEGER NOT NULL DEFAULT 1
  CHECK (next_list_page > 0);

ALTER TABLE complex_refresh_state
  ADD COLUMN list_records_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(list_records_json));

ALTER TABLE complex_refresh_state
  ADD COLUMN list_fields_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(list_fields_json));
