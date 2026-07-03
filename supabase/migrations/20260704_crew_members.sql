CREATE TABLE IF NOT EXISTS crew_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crew_members_user_id_idx ON crew_members (user_id);
