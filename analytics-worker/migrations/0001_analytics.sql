CREATE TABLE sessions (
 session_id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, origin TEXT NOT NULL,
 started INTEGER NOT NULL, last_seen INTEGER NOT NULL, active_seconds INTEGER NOT NULL DEFAULT 0,
 device TEXT NOT NULL, browser TEXT NOT NULL, os TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL,
 ended INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE events (
 event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(session_id),
 event TEXT NOT NULL, timestamp INTEGER NOT NULL, food TEXT
);
CREATE INDEX sessions_started ON sessions(started);
CREATE INDEX sessions_visitor ON sessions(visitor_id);
CREATE INDEX events_session ON events(session_id,timestamp);
CREATE INDEX events_name ON events(event,session_id);
