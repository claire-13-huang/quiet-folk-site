CREATE TABLE email_notifications_new (
 session_id TEXT NOT NULL REFERENCES sessions(session_id), kind TEXT NOT NULL CHECK(kind IN ('accepted','summary','completed')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 next_attempt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 payload TEXT, provider_id TEXT, last_error TEXT, api_status INTEGER,
 PRIMARY KEY(session_id,kind)
);
INSERT INTO email_notifications_new SELECT session_id,kind,status,next_attempt,attempts,CASE WHEN status IN ('sent','failed') THEN NULL ELSE payload END,provider_id,last_error,api_status FROM email_notifications;
DROP TABLE email_notifications;
ALTER TABLE email_notifications_new RENAME TO email_notifications;
CREATE INDEX email_notifications_due ON email_notifications(status,next_attempt);
