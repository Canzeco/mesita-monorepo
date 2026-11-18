-- MESITA-4304: a waiter approves the story BEFORE the guest pays, on top of
-- MESITA-4296's app check.
--
-- Pato, 2026-11-17: the story gets verified by the waiter, then you pay; the
-- principal is yours at once; keep the story up 3 hours and the bonus lands.
--
--   1. The guest posts a story tagging @mesita and the place.
--   2. consumer-web-check-story finds it (MESITA-4296) and points it at the
--      place (story_review_open): the story gets a QR token for the waiter.
--   3. The waiter opens visit.mesita.ai/story/<token>, types the place's
--      waiter code, and approves or rejects (story_review). An approval is
--      for one place; a rejected story never counts, the guest posts another.
--   4. Only an approved story can be paid: the buy refuses story_not_verified;
--      story_claim voids the bonus not_verified as the backstop.
--   5. MESITA-4296's reservation, claim and 3-hour re-check are unchanged.
--
--   story_mentions.review_*     token, place, decision, when, which phone
--   story_review_open           the check's point-at-place (mint the token)
--   story_review                the waiter's approve / reject
--   story_claim                 + not_verified

-- ── 1. The review lives on the story ────────────────────────────────────────
alter table public.story_mentions
  add column review_token text unique check (review_token is null or review_token ~ '^[0-9a-f]{32}$'),
  add column review_place_id uuid references public.places (id) on delete set null,
  add column review text check (review is null or review in ('approved', 'rejected')),
  add column reviewed_at timestamptz,
  add column review_device_hash text,
  add constraint story_mentions_review_has_place check (review is null or (review_place_id is not null and reviewed_at is not null));

comment on column public.story_mentions.review_token is
  'MESITA-4304: the Story QR''s key (32 hex): visit.mesita.ai/story/<token>. Minted by story_review_open. Never logged.';
comment on column public.story_mentions.review_place_id is
  'MESITA-4304: the place whose waiter may approve this story, and the only place an approval pays at. Set by story_review_open; moving it to another place clears the decision.';
comment on column public.story_mentions.review is
  'MESITA-4304: the waiter''s decision: approved (the guest may pay) | rejected (never counts) | null (waiting).';
comment on column public.story_mentions.review_device_hash is
  'MESITA-4304: a hash of the staff phone''s device id that decided. Never the staff token.';

-- ── 2. The void reason ──────────────────────────────────────────────────────
alter table public.wallet_purchases drop constraint if exists wallet_purchases_story_bonus_void_reason_check;
alter table public.wallet_purchases add constraint wallet_purchases_story_bonus_void_reason_check
  check (story_bonus_void_reason in ('unreachable', 'expired', 'refunded', 'operator', 'mention_lost', 'no_mention', 'not_verified'));

-- ── 3. Point the story at the place (the guest's check) ─────────────────────
-- Called by consumer-web-check-story with the story it found. Mints the token
-- once. Moving to another place clears the decision (an approval is for one
-- place). A story a live purchase reserves is never moved.
create or replace function public.story_review_open(p_mention uuid, p_place uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if m.review_place_id is distinct from p_place
     and m.purchase_id is null
     and not exists (select 1 from public.wallet_purchases p
                      where p.story_mention_id = m.id and p.status not in ('failed', 'expired', 'refunded')) then
    update public.story_mentions
       set review_place_id = p_place, review = null, reviewed_at = null, review_device_hash = null
     where id = m.id
     returning * into m;
  end if;
  if m.review_token is null then
    update public.story_mentions set review_token = replace(gen_random_uuid()::text, '-', '')
     where id = m.id
     returning * into m;
  end if;
  return jsonb_build_object(
    'ok', true,
    'token', m.review_token,
    'place_id', m.review_place_id,
    'review', m.review,
    'reviewed_at', m.reviewed_at);
end;
$function$;
revoke all on function public.story_review_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.story_review_open(uuid, uuid) to service_role;

-- ── 4. The waiter's decision ────────────────────────────────────────────────
-- visit-web-review-story verified the waiter code for p_place (the story's
-- place as the EF read it); this re-checks it under the story's lock.
create or replace function public.story_review(p_token text, p_place uuid, p_approve boolean, p_device_hash text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  r record;
  v_now timestamptz := now();
begin
  select * into m from public.story_mentions where review_token = p_token for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if m.review_place_id is distinct from p_place then
    return jsonb_build_object('ok', false, 'code', 'wrong_place');
  end if;
  if m.purchase_id is not null then
    return jsonb_build_object('ok', false, 'code', 'story_claimed');
  end if;
  if m.review = 'approved' and p_approve then
    return jsonb_build_object('ok', true, 'outcome', 'already_approved', 'mention_id', m.id, 'reviewed_at', m.reviewed_at);
  end if;
  if m.review = 'rejected' and not p_approve then
    return jsonb_build_object('ok', true, 'outcome', 'already_rejected', 'mention_id', m.id, 'reviewed_at', m.reviewed_at);
  end if;
  if m.review is not null then
    return jsonb_build_object('ok', false, 'code', 'already_decided', 'review', m.review);
  end if;
  if p_approve then
    select * into r from public.story_rules();
    if m.mentioned_at + interval '24 hours' < v_now + r.bonus_wait + r.check_margin then
      return jsonb_build_object('ok', false, 'code', 'story_too_old');
    end if;
  end if;
  update public.story_mentions
     set review = case when p_approve then 'approved' else 'rejected' end,
         reviewed_at = v_now,
         review_device_hash = p_device_hash
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', case when p_approve then 'approved' else 'rejected' end,
                            'mention_id', m.id, 'reviewed_at', v_now);
end;
$function$;
revoke all on function public.story_review(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.story_review(text, uuid, boolean, text) to service_role;

-- ── 5. The claim needs the approval (the backstop of the buy's gate) ─────────
create or replace function public.story_claim(p_purchase uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  m public.story_mentions;
  r record;
  v_handle text;
  v_now timestamptz := now();
  v_reason text;
begin
  select * into v from public.wallet_purchases where id = p_purchase;
  if v.story_mention_id is null then
    v_reason := 'no_mention';
  else
    select * into r from public.story_rules();
    select * into m from public.story_mentions where id = v.story_mention_id for update;
    select lower(instagram_handle) into v_handle from public.consumers where id = v.consumer_id;
    if m.id is null then
      v_reason := 'mention_lost';
    elsif m.purchase_id is not null and m.purchase_id <> v.id then
      v_reason := 'mention_lost';
    elsif v_handle is null or m.ig_handle is distinct from v_handle then
      v_reason := 'mention_lost';
    elsif m.livemode <> v.livemode then
      v_reason := 'mention_lost';
    elsif m.mentioned_at + interval '24 hours' < v_now + r.bonus_wait + r.credit_margin then
      v_reason := 'mention_lost';
    elsif m.review is distinct from 'approved' or m.review_place_id is distinct from v.place_id then
      v_reason := 'not_verified';
    end if;
  end if;

  if v_reason is not null then
    update public.wallet_purchases
       set story_bonus = 'void', story_bonus_void_reason = v_reason, story_bonus_decided_at = v_now, updated_at = v_now
     where id = v.id and story_bonus is null;
    return v_reason;
  end if;

  update public.story_mentions set purchase_id = v.id where id = m.id;
  update public.wallet_purchases
     set story_activated_at = v_now, story_recheck_at = v_now + r.bonus_wait, story_recheck_tries = 0, updated_at = v_now
   where id = v.id;
  return 'claimed';
end;
$function$;
revoke all on function public.story_claim(uuid) from public, anon, authenticated;
grant execute on function public.story_claim(uuid) to service_role;

comment on function public.story_review_open(uuid, uuid) is
  'MESITA-4304: points a found story at the place the guest is buying at and mints its waiter QR token once. Moving it to another place clears the waiter''s decision; a story a live purchase reserves is never moved. Answers {ok, token, place_id, review, reviewed_at} or {ok:false, code:gone}. Service role only.';
comment on function public.story_review(text, uuid, boolean, text) is
  'MESITA-4304: the waiter''s approve / reject of one story (by its QR token) at p_place, whose waiter code the EF checked. Refuses gone, wrong_place, story_claimed, already_decided, story_too_old (approve only: the story must outlive a re-check); a repeat of the same decision answers already_approved / already_rejected. Service role only.';
comment on function public.story_claim(uuid) is
  'MESITA-4296, MESITA-4304: claims a paid Story''s reserved mention when it is unclaimed, of the guest''s current verified handle, of the same livemode, young enough to outlive the re-check (mentioned_at + 24 h >= now + bonus_wait + credit_margin) and approved by a waiter of the purchase''s place; sets story_activated_at = now and story_recheck_at = now + bonus_wait. Otherwise voids the bonus: no_mention, mention_lost or not_verified. Called by wallet_credit_purchase under its locks. Service role only.';
comment on table public.story_mentions is
  'MESITA-4264, MESITA-4296, MESITA-4304: one Instagram story that tagged @mesita (Meta''s story_mention webhook, or the test-mode emulator). Belongs to a handle: consumer-web-check-story shows it to the guest of that verified handle and points it at the place (review_place_id, review_token); a waiter of that place approves it (review); the buy reserves an approved one (wallet_purchases.story_mention_id) and the credit claims it (purchase_id; one story pays one bonus). Unclaimed, unreserved rows are deleted after 24 hours (wallet_purge_story_mentions). EF-only.';

-- ── 6. Post-flight ──────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.story_review(text, uuid, boolean, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.story_review_open(uuid, uuid)', 'EXECUTE') then
    raise exception 'a Story review function is open to clients';
  end if;
end;
$$;
