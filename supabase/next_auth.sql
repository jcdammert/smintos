-- ===========================================================================
-- NextAuth (Auth.js) Supabase adapter schema.
-- Creates the `next_auth` schema + tables used to store magic-link
-- verification tokens, auth users, sessions, and accounts.
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- IMPORTANT: After running this, go to Supabase -> Project Settings -> API ->
-- "Exposed schemas" and add `next_auth` to the list, then Save.
-- ===========================================================================

create schema if not exists next_auth;

grant usage on schema next_auth to service_role;
grant all on schema next_auth to postgres;

-- --- users -----------------------------------------------------------------
create table if not exists next_auth.users (
  id uuid not null default gen_random_uuid(),
  name text,
  email text,
  "emailVerified" timestamptz,
  image text,
  primary key (id),
  unique (email)
);
grant all on table next_auth.users to postgres;
grant all on table next_auth.users to service_role;

-- --- sessions --------------------------------------------------------------
create table if not exists next_auth.sessions (
  id uuid not null default gen_random_uuid(),
  expires timestamptz not null,
  "sessionToken" text not null,
  "userId" uuid,
  primary key (id),
  foreign key ("userId") references next_auth.users (id) on delete cascade
);
grant all on table next_auth.sessions to postgres;
grant all on table next_auth.sessions to service_role;

-- --- accounts --------------------------------------------------------------
create table if not exists next_auth.accounts (
  id uuid not null default gen_random_uuid(),
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  "userId" uuid,
  primary key (id),
  foreign key ("userId") references next_auth.users (id) on delete cascade
);
grant all on table next_auth.accounts to postgres;
grant all on table next_auth.accounts to service_role;

-- --- verification tokens (magic links) ------------------------------------
create table if not exists next_auth.verification_tokens (
  identifier text,
  token text,
  expires timestamptz not null,
  primary key (token)
);
grant all on table next_auth.verification_tokens to postgres;
grant all on table next_auth.verification_tokens to service_role;
