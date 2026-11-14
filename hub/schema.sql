-- Game Hub schema (SQLite)
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT UNIQUE,                 -- NULL untuk tamu
  pass_hash    TEXT,
  display_name TEXT NOT NULL,
  is_guest     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS saves (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  data       TEXT NOT NULL,                 -- JSON
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  board      TEXT NOT NULL,
  value      REAL NOT NULL,
  meta       TEXT,                          -- JSON kecil (rebirth, tries, dsb)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores(game, board, value);
CREATE TABLE IF NOT EXISTS rate_limit (
  bucket TEXT NOT NULL,                     -- contoh: login:1.2.3.4
  ts     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate ON rate_limit(bucket, ts);
