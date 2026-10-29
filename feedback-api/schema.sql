-- Patient feedback from the office QR posters.
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  office TEXT NOT NULL,
  rating INTEGER,
  recommend TEXT,
  answers TEXT NOT NULL DEFAULT '{}',   -- quick ratings, keyed by question
  comments TEXT,
  shoutout_person TEXT,
  shoutout_text TEXT,
  wants_reply INTEGER NOT NULL DEFAULT 0,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'new',   -- new | in_progress | done
  staff_note TEXT,
  replied_at TEXT,
  updated_at TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS responses_created ON responses(created_at);
CREATE INDEX IF NOT EXISTS responses_status ON responses(status);
-- Rate limiting for submissions and staff sign-in attempts.
CREATE TABLE IF NOT EXISTS hits (
  kind TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hits_lookup ON hits(kind, ip_hash, at);
