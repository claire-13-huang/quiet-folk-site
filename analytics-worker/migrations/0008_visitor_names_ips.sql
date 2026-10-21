CREATE TABLE visitor_names (
 visitor_id TEXT NOT NULL, origin TEXT NOT NULL, name TEXT NOT NULL,
 confirmed_at INTEGER NOT NULL, PRIMARY KEY(visitor_id,origin)
);
CREATE TABLE session_ips (
 session_id TEXT NOT NULL REFERENCES sessions(session_id), ip TEXT NOT NULL,
 first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('request','notification_email')),
 PRIMARY KEY(session_id,ip)
);
CREATE INDEX session_ips_address ON session_ips(ip);
