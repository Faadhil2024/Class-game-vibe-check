-- The Class Vibe Check: Supabase Migration for camp_sessions, camp_students, camp_answers
-- Safe and idempotent: preserves existing tables (including "votes") and existing rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ensure camp_sessions exists with all expected columns
CREATE TABLE IF NOT EXISTS public.camp_sessions (
  id text PRIMARY KEY,
  label text NOT NULL DEFAULT 'Live Classroom Session',
  join_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

ALTER TABLE public.camp_sessions
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Live Classroom Session',
  ADD COLUMN IF NOT EXISTS join_code text NOT NULL DEFAULT 'VIBE-CLASS',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Ensure at most one active session before creating the partial unique index
WITH ranked_active AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn
  FROM public.camp_sessions
  WHERE is_active = true
)
UPDATE public.camp_sessions s
SET is_active = false,
    archived_at = COALESCE(s.archived_at, now())
FROM ranked_active r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS camp_sessions_single_active_idx
  ON public.camp_sessions (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS camp_sessions_join_code_idx
  ON public.camp_sessions (join_code);

-- 2. Ensure camp_students exists with all expected columns & duplicate-prevention constraint
CREATE TABLE IF NOT EXISTS public.camp_students (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  device_id text NOT NULL,
  token_hash text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Joined',
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.camp_students
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Joined',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'camp_students_status_check'
      AND conrelid = 'public.camp_students'::regclass
  ) THEN
    ALTER TABLE public.camp_students
      ADD CONSTRAINT camp_students_status_check
      CHECK (status IN ('Joined', 'In Progress', 'Completed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS camp_students_session_device_uidx
  ON public.camp_students (session_id, device_id);

CREATE INDEX IF NOT EXISTS camp_students_session_status_idx
  ON public.camp_students (session_id, status);

-- 3. Ensure camp_answers exists with atomic upsert key (student_id, question_id)
CREATE TABLE IF NOT EXISTS public.camp_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  student_id text NOT NULL,
  question_id text NOT NULL,
  choice text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_answers
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS student_id text,
  ADD COLUMN IF NOT EXISTS question_id text,
  ADD COLUMN IF NOT EXISTS choice text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'camp_answers_question_check'
      AND conrelid = 'public.camp_answers'::regclass
  ) THEN
    ALTER TABLE public.camp_answers
      ADD CONSTRAINT camp_answers_question_check
      CHECK (question_id IN ('q1','q2','q3','q4','q5','q6','q7','q8','q9','q10'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'camp_answers_choice_check'
      AND conrelid = 'public.camp_answers'::regclass
  ) THEN
    ALTER TABLE public.camp_answers
      ADD CONSTRAINT camp_answers_choice_check
      CHECK (choice IN ('A', 'B'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS camp_answers_student_question_uidx
  ON public.camp_answers (student_id, question_id);

CREATE INDEX IF NOT EXISTS camp_answers_session_idx
  ON public.camp_answers (session_id);

-- 4. Protect private student & vote tables via Row Level Security
-- Only Vercel server-side APIs using SUPABASE_SECRET_KEY bypass RLS.
-- Browser clients using VITE_SUPABASE_PUBLISHABLE_KEY cannot read or write camp_* directly.
ALTER TABLE public.camp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_answers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.camp_sessions, public.camp_students, public.camp_answers FROM anon, authenticated;
