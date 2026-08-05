ALTER TABLE complex
  ADD COLUMN trade_cached_at TEXT
  CHECK (trade_cached_at IS NULL OR length(trade_cached_at) = 24);
