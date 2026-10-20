ALTER TABLE private_letters ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE private_letters ADD COLUMN updated_at INTEGER;
ALTER TABLE private_letters ADD COLUMN deleted_at INTEGER;
ALTER TABLE private_letters ADD COLUMN last_operation_id TEXT;
ALTER TABLE private_letters ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 1;
UPDATE private_letters SET notify_enabled=0;
ALTER TABLE feedback ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feedback ADD COLUMN deleted_at INTEGER;
ALTER TABLE feedback ADD COLUMN last_operation_id TEXT;
ALTER TABLE feedback_notifications ADD COLUMN message_snapshot TEXT;
ALTER TABLE feedback_notifications ADD COLUMN rating_snapshot INTEGER;
CREATE TABLE room_note_changes (
 kind TEXT NOT NULL CHECK(kind IN ('private','feedback')), note_id TEXT NOT NULL,
 revision INTEGER NOT NULL, operation_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled')),
 next_attempt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT, api_status INTEGER, last_error TEXT,
 PRIMARY KEY(kind,note_id,revision)
);
CREATE INDEX room_note_changes_due ON room_note_changes(status,next_attempt);
