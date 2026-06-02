-- Drop and recreate all tables cleanly
DROP TABLE IF EXISTS question_options;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS settings;

CREATE TABLE questions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  category  TEXT NOT NULL,
  question  TEXT NOT NULL,
  dimension TEXT NOT NULL DEFAULT '',
  q_id      TEXT NOT NULL DEFAULT '',
  order_num INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE question_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  text        TEXT NOT NULL,
  weight      REAL NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  sector      TEXT NOT NULL DEFAULT '',
  code_hash   TEXT NOT NULL UNIQUE,
  code        TEXT,
  company_uen TEXT,
  round_label TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE responses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  answers_json        TEXT NOT NULL,
  total_score         INTEGER NOT NULL,
  score_pct           REAL NOT NULL,
  readiness_level     TEXT NOT NULL,
  recommended_courses TEXT NOT NULL DEFAULT '[]',
  is_sp_staff         INTEGER NOT NULL DEFAULT 0,
  department          TEXT NOT NULL DEFAULT '',
  session_id          INTEGER REFERENCES sessions(id),
  submitted_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
