-- nexus schema + projects table for the reference deployment's shared self-hosted Supabase
-- (https://supabase.houshkar.ir). Option A from issue #3: NEXUS keeps a
-- dedicated schema instead of the instance's tenant_id model, so its rows are
-- structurally separate from every other tenant's.
-- Matches packages/app/src/lib/cloud/storage.ts. Safe to re-run.
--
-- Preflight (run first; on a first apply it must return zero rows):
--   select nspname from pg_namespace where nspname = 'nexus';

begin;

create schema if not exists nexus;

-- on delete cascade: auth.users is shared by every tenant on the instance, so
-- NEXUS must never block another product from deleting a user.
create table if not exists nexus.projects (
  id text primary key,
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entity_count int not null default 0,
  layer_count int not null default 0
);

create index if not exists projects_owner_id_idx on nexus.projects (owner_id);

-- Grants are limited to this schema. anon gets nothing: the app only touches
-- cloud data after sign-in.
revoke all on schema nexus from public;
revoke all on all tables in schema nexus from public, anon;
grant usage on schema nexus to authenticated, service_role;
grant select, insert, update, delete on nexus.projects to authenticated;
grant all on nexus.projects to service_role;

alter table nexus.projects enable row level security;

drop policy if exists "owner full access" on nexus.projects;
create policy "owner full access"
  on nexus.projects
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

commit;
