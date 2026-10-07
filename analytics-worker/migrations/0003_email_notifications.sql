CREATE TABLE email_notifications (
 session_id TEXT NOT NULL REFERENCES sessions(session_id), kind TEXT NOT NULL CHECK(kind IN ('accepted','summary')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 next_attempt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 payload TEXT, provider_id TEXT, last_error TEXT,
 PRIMARY KEY(session_id,kind)
);
CREATE INDEX email_notifications_due ON email_notifications(status,next_attempt);
