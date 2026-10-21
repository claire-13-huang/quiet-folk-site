-- Preserve legacy exclusions for individual visits in mixed real/test browsers.
INSERT INTO session_test_exclusions(session_id,reason,created_at)
 SELECT s.session_id,'legacy_test_session',strftime('%s','now')*1000
 FROM sessions s
 WHERE s.is_test=1 AND NOT EXISTS (
  SELECT 1 FROM test_visitors t WHERE t.visitor_id=s.visitor_id AND t.origin=s.origin
 )
 ON CONFLICT(session_id) DO NOTHING;
