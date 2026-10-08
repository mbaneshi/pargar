# Supabase SQL (the reference deployment's shared self-hosted instance, `supabase.houshkar.ir`)

Checked-in DDL/RLS for the `nexus` schema and Storage bucket on the Iran lane.
the reference deployment's Supabase is shared by several tenants and normally isolates them with a
`tenant_id` column; NEXUS instead keeps a dedicated `nexus` schema (Option A,
issue #3) so the app code stays identical to the USA repo and isolation does
not depend on a per-policy tenant predicate.

There's no `supabase/config.toml` and this isn't wired to the Supabase CLI's
local dev stack; these are plain SQL files applied by hand by the server
session (Supabase Studio's SQL editor, or `psql` as the `postgres` role) in
filename order. Both files are wrapped in a transaction and safe to re-run.

- `migrations/20260904120000_nexus_schema.sql` — `nexus` schema, `projects`
  table, grants for `authenticated` only, owner-only RLS policy.
- `migrations/20260904120100_nexus_storage_policies.sql` — `nexus` Storage
  bucket + owner-scoped object policies.

## Differences from the USA repo's migrations

Same table and policies, hardened for a shared instance: explicit grants (the
USA files grant nothing), policies restricted to `authenticated`, `drop policy
if exists` so they can be re-run, and `on delete cascade` on the
`auth.users` foreign key so NEXUS never blocks another tenant from deleting a
user. The cascade removes project rows only; the user's Storage objects are
left behind.

## Before applying

Both must return zero rows on a first apply. Stop if either returns anything —
another tenant already owns the name.

```sql
select nspname from pg_namespace where nspname = 'nexus';
select id, public from storage.buckets where id = 'nexus';
```

## Manual steps SQL can't do

Instance configuration, in the Supabase stack's env file. **Append — do not
replace the existing values; they belong to the other tenants.**

```
PGRST_DB_SCHEMAS=<current value>,nexus
ADDITIONAL_REDIRECT_URLS=<current value>,https://cad.houshkar.ir
```

- `PGRST_DB_SCHEMAS`: `nexus` is a non-`public` schema, so PostgREST won't
  serve it (`client.schema('nexus').from('projects')` in
  `packages/app/src/lib/cloud/storage.ts`) until it is in the exposed list.
- `ADDITIONAL_REDIRECT_URLS`: lets auth redirect back to the app after OAuth
  or an email link. Leave `SITE_URL` alone; it is shared.

Recreate the PostgREST and auth containers afterwards so they pick the values
up. This briefly interrupts the API for every tenant.

## Verify

```sql
select has_schema_privilege('anon', 'nexus', 'usage');            -- f
select has_schema_privilege('authenticated', 'nexus', 'usage');   -- t
select relrowsecurity from pg_class where oid = 'nexus.projects'::regclass;  -- t
select policyname, roles from pg_policies
 where schemaname = 'nexus'
    or (schemaname = 'storage' and policyname like 'nexus owner %');  -- 5 rows, all {authenticated}
```

## Known property of the shared instance

Auth users are one pool per instance: an account on any other product on
the reference deployment's Supabase can also sign in to NEXUS. It sees only its own rows.
