-- Ghost-partner hold (MESITA-1311): a CONFIRMED guest report puts a place's
-- reward lane under review — assessPromoLane answers { open: false,
-- code: 'pending_review' } before forfeit/pause, and Mesita reactivates the
-- lane when review ends (admin-web-review-ticket-report restore).
--
-- The column already exists on the live singleton: it was applied cloud-side
-- during the MESITA-1154 worktree and never mirrored (the generated
-- database.types.ts and place-doc.ts carried it; no migration did).
-- IF NOT EXISTS reconciles the ledger with reality.

alter table public.projects
  add column if not exists reward_lane_pending_review_at timestamptz;

comment on column public.projects.reward_lane_pending_review_at is
  'Ghost-partner hold (MESITA-1311): set by admin-web-review-ticket-report when a guest report is confirmed; closes the reward lane (pending_review) until its restore action clears it. Null = no hold.';

-- Expose it through public.profiles the same way the other membership/strike
-- columns ride (place-columns.ts: "projects columns exposed via profiles").
-- CREATE OR REPLACE can only APPEND columns, so it lands last. The rebuild
-- MUST keep security_invoker = true — dropping it silently reopens the
-- consumer-browse leak (supabase/CLAUDE.md invariant).
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.profiles'::regclass, true);

  if v_def like '%reward_lane_pending_review_at%' then
    raise notice 'profiles already projects reward_lane_pending_review_at — nothing to do';
  else
    if v_def not like '%p.reservations_enabled%' then
      raise exception 'profiles does not project reservations_enabled; refusing to guess anchor';
    end if;

    v_new := replace(
      v_def,
      'p.reservations_enabled
   FROM projects u',
      'p.reservations_enabled,
    u.reward_lane_pending_review_at
   FROM projects u'
    );

    if v_new = v_def then
      raise exception 'profiles view anchor did not match; view left untouched';
    end if;

    execute 'create or replace view public.profiles with (security_invoker = true) as '
      || v_new;
  end if;
end $$;
