-- ============================================================
-- Appointments v2  —  GHL-native schema
-- Run this in Supabase SQL Editor.
-- WARNING: drops the old appointments table and all its data.
-- Back up first if you have existing rows you need.
-- ============================================================

DROP TABLE IF EXISTS appointments CASCADE;

CREATE TABLE appointments (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'unconfirmed'
                            CHECK (status IN ('confirmed','cancelled','showed','no_show','invalid','unconfirmed')),
  contact_id    TEXT,                    -- GHL contact id
  contact_name  TEXT,
  notes         TEXT,
  assigned_to   TEXT,
  job_type      TEXT,
  ghl_event_id  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON appointments
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for the common date-range query
CREATE INDEX appointments_user_start ON appointments (user_id, start_time);
