ALTER TABLE sessions ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0,1));
-- Exact sessions created by the analytics deployment verification, never inferred from device or location.
UPDATE sessions SET is_test=1 WHERE session_id IN ('0fe30fc9-5b5e-4d65-9223-961852728f06','df8d18e9-9f56-44fa-b43e-872a70e96005');
