CREATE TABLE test_visitors (
 visitor_id TEXT NOT NULL, origin TEXT NOT NULL,
 PRIMARY KEY(visitor_id,origin)
);
CREATE TABLE session_test_exclusions (
 session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
 reason TEXT NOT NULL, created_at INTEGER NOT NULL
);
-- Keep existing browser-wide exclusions. A single excluded visit must not
-- exclude a real visitor's other visits or future sessions.
INSERT INTO test_visitors(visitor_id,origin)
 SELECT visitor_id,origin FROM sessions GROUP BY visitor_id,origin HAVING MIN(is_test)=1;
