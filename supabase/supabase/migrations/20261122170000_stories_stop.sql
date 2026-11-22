-- MESITA-4641 — STORIES ARE GONE FOR THE MVP. Pato, 2026-11-22: "WE ARE GOING
-- TO REMOVE STORIES FOR THE MVP. REMOVE STORIES FROM EVERYWHERE … TOO COMPLEX."
-- This migration stops every Story from being sold or created, and the
-- 10-minute recheck cron. The Story functions, config and buckets go in
-- MESITA-4642; the stories / story_mentions tables a week later (rollback rows).
-- The last commit with Stories is the git tag `stories-final`.
--
-- Rollback: drop the constraint, re-create story_create from
-- 20261122xxxx history (git show stories-final), reschedule recheck-stories.

-- 1. No guest may be owed a Story bonus when the machinery stops. Every Story
--    is released (bonus paid) or void today; anything else stops this migration
--    and names the row, so it is settled by hand (wallet_override_story) first.
do $$
declare
  r record;
begin
  select s.id, s.purchase_id, s.state into r
    from public.stories s
   where s.state not in ('released', 'void')
   limit 1;
  if found then
    raise exception 'story_unsettled: story % purchase % state %; settle it, then re-apply', r.id, r.purchase_id, r.state;
  end if;
end;
$$;

-- 2. No place sells the Story voucher, and nothing can switch it back on
--    (an old Business build, a script). Dropped with the column in MESITA-4642.
update public.place_payment_settings
   set voucher_story = false, updated_at = now()
 where voucher_story;

alter table public.place_payment_settings
  alter column voucher_story set default false;

alter table public.place_payment_settings
  add constraint place_payment_settings_no_story check (voucher_story = false);

comment on column public.place_payment_settings.voucher_story is
  'Dead since MESITA-4641 (Stories are gone for the MVP): always false, held by place_payment_settings_no_story. Nothing reads it.';

-- 3. No Story row can be born: story_create is the one door a paid Story
--    purchase opens. The Edge Functions that still call it stay deployed until
--    MESITA-4642 retires them; they get this error instead of a Story.
create or replace function public.story_create(p_purchase uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'story_retired: the Story voucher is gone (MESITA-4641)';
end;
$$;

-- 4. The recheck cron stops (its Edge Function retires in MESITA-4642).
select cron.unschedule(jobid) from cron.job where jobname = 'recheck-stories';
