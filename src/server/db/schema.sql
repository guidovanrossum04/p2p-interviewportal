CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'evaluator', 'candidate')),
  department TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'evaluator', 'candidate'));

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  role_applied TEXT NOT NULL,
  department TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  admin_reviewed_at TIMESTAMPTZ,
  admin_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (admin_review_status IN ('pending', 'accepted', 'reupload_requested')),
  admin_feedback TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE videos ADD COLUMN IF NOT EXISTS admin_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS admin_review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_admin_review_status_check;
ALTER TABLE videos ADD CONSTRAINT videos_admin_review_status_check CHECK (admin_review_status IN ('pending', 'accepted', 'reupload_requested'));

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_ciphertext TEXT NOT NULL DEFAULT '',
  token_preview TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('upload', 'review')),
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL DEFAULT '',
  role_applied TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  video_id TEXT REFERENCES videos(id),
  evaluator_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  access_count INTEGER NOT NULL DEFAULT 0,
  rubric_weights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK ((purpose = 'upload' AND video_id IS NULL AND evaluator_id IS NULL) OR
         (purpose = 'review' AND video_id IS NOT NULL AND evaluator_id IS NOT NULL))
);

ALTER TABLE share_links ADD COLUMN IF NOT EXISTS rubric_weights JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id),
  evaluator_id TEXT NOT NULL REFERENCES users(id),
  share_link_id TEXT NOT NULL REFERENCES share_links(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_review', 'completed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_share_link_id_key;
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_video_id_key;

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE REFERENCES assignments(id),
  scores JSONB NOT NULL,
  overall_score INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('selected', 'rejected', 'shortlist', 'hold', 'reject')),
  notes TEXT NOT NULL DEFAULT '',
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_decision_check;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_decision_check
  CHECK (decision IN ('selected', 'rejected', 'shortlist', 'hold', 'reject'));

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_smtp_password TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE share_links ADD COLUMN IF NOT EXISTS token_ciphertext TEXT NOT NULL DEFAULT '';
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS submission_id TEXT;

UPDATE videos
SET details = jsonb_set(
  jsonb_set(details, '{submissionId}', to_jsonb(COALESCE(details->>'submissionId', details->>'submissionBatchId', id)), TRUE),
  '{submissionBatchId}', to_jsonb(COALESCE(details->>'submissionId', details->>'submissionBatchId', id)), TRUE
);

UPDATE share_links sl
SET submission_id = CASE
  WHEN sl.purpose = 'upload' THEN sl.id
  ELSE COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', sl.video_id)
END
FROM videos v
WHERE sl.purpose = 'review' AND v.id = sl.video_id AND sl.submission_id IS NULL;

UPDATE share_links SET submission_id = id WHERE purpose = 'upload' AND submission_id IS NULL;
ALTER TABLE share_links ALTER COLUMN submission_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS share_links_expiry_idx ON share_links (expires_at);
CREATE INDEX IF NOT EXISTS videos_status_created_idx ON videos (status, created_at DESC);
CREATE INDEX IF NOT EXISTS assignments_evaluator_status_idx ON assignments (evaluator_id, status);