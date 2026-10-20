CREATE TABLE private_letters (
 id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, session_id TEXT NOT NULL,
 origin TEXT NOT NULL, content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 12000),
 created_at INTEGER NOT NULL, is_test INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX private_letters_visitor ON private_letters(visitor_id,created_at);
CREATE TABLE feedback (
 id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, session_id TEXT NOT NULL,
 origin TEXT NOT NULL, rating INTEGER CHECK(rating BETWEEN 1 AND 5),
 message TEXT NOT NULL DEFAULT '' CHECK(length(message)<=8000),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, sealed_at INTEGER,
 is_test INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX feedback_visitor ON feedback(visitor_id,created_at);
CREATE TABLE feedback_notifications (
 feedback_id TEXT PRIMARY KEY REFERENCES feedback(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 next_attempt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT, api_status INTEGER, last_error TEXT
);
CREATE INDEX feedback_notifications_due ON feedback_notifications(status,next_attempt);
