
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS college_name TEXT,
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS classes_per_day INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS working_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  ADD COLUMN IF NOT EXISTS attendance_target NUMERIC NOT NULL DEFAULT 75;

-- Extend timetable_slots
ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS faculty TEXT,
  ADD COLUMN IF NOT EXISTS room TEXT,
  ADD COLUMN IF NOT EXISTS slot_type TEXT NOT NULL DEFAULT 'class',
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Semester records (Sem 1..8, SGPA, credits, backlogs)
CREATE TABLE IF NOT EXISTS public.semester_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
  sgpa NUMERIC,
  credits_earned NUMERIC,
  total_credits NUMERIC,
  backlogs INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, semester)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_records TO authenticated;
GRANT ALL ON public.semester_records TO service_role;
ALTER TABLE public.semester_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own semester records" ON public.semester_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_semester_records_updated ON public.semester_records;
CREATE TRIGGER trg_semester_records_updated
  BEFORE UPDATE ON public.semester_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
