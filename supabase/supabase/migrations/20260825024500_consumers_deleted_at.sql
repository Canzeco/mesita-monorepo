-- MESITA-1250: deletion is a status. A consumer with visit/reservation
-- history is never hard-deleted — deleted_at hides them; ticket FKs stay
-- valid (ON DELETE RESTRICT). History-free accounts still drop via auth
-- delete (consumers cascades). Admin reset remains the wipe-with-history path.

alter table public.consumers
  add column if not exists deleted_at timestamptz;

create index if not exists consumers_deleted_at_idx
  on public.consumers (deleted_at)
  where deleted_at is not null;

comment on column public.consumers.deleted_at is
  'Soft-delete. Set when the guest closes an account that still has visit or reservation tickets. Null = live. History-free closes hard-delete auth.users (this row cascades).';

-- Visibility half: a tombstoned guest must not read their own row on the
-- leftover authenticated SELECT (consumers_select_self). Service role
-- bypasses RLS so staff ticket EFs still resolve the guest on a live ticket.
drop policy if exists "consumers_select_self" on public.consumers;
create policy "consumers_select_self" on public.consumers
  for select to authenticated
  using (id = (select auth.uid()) and deleted_at is null);
