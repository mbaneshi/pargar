-- nexus Storage bucket + object-level policies for the reference deployment's shared Supabase.
-- There is no backend issuing signed URLs — supabase-js in the browser talks
-- to Storage directly, so access is enforced here. Safe to re-run.
-- Path layout (packages/app/src/lib/cloud/storage.ts):
--   projects/{userId}/{projectId}.json
--   exports/{userId}/{projectId}.dxf
-- storage.foldername(name) excludes the filename, so folder [1] is the
-- top-level prefix ("projects"/"exports") and folder [2] is the userId.
--
-- storage.objects is shared by every tenant. These policies are permissive and
-- each is confined to bucket_id = 'nexus', so they cannot change access to any
-- other tenant's bucket.
--
-- Preflight (run first; on a first apply it must return zero rows — the insert
-- below would silently reuse someone else's 'nexus' bucket):
--   select id, public from storage.buckets where id = 'nexus';

begin;

insert into storage.buckets (id, name, public)
values ('nexus', 'nexus', false)
on conflict (id) do nothing;

drop policy if exists "nexus owner select" on storage.objects;
create policy "nexus owner select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'nexus'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "nexus owner insert" on storage.objects;
create policy "nexus owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'nexus'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "nexus owner update" on storage.objects;
create policy "nexus owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'nexus'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'nexus'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "nexus owner delete" on storage.objects;
create policy "nexus owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'nexus'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

commit;
