-- The Diamond List closes the reach door (MESITA-2044).
--
-- Pato, 2026-09-22: "there are no classes, either you are diamond or you are
-- not. its more like a List. Diamond List. you are in the list or you don't,
-- not in between"
--
-- A guest is ON the Diamond List or NOT. Invitation — a named grant from
-- Mesita (admin grant) or a 10-digit PIN — is the ONLY way on. Instagram is a
-- separate fact (1,000+ followers = verified, the Story bonus) and grants
-- NOTHING toward the list.
--
-- Until this migration the list was not invitation-only. The reach door in
-- _shared/class-doors.ts (pickEffectiveClass) opened the highest
-- `classes` row whose follower_threshold the guest's count cleared — Silver
-- at 1,000 and DIAMOND at 20,000 — and consumer-web-claim-instagram stores a
-- SELF-DECLARED count. Anyone could type their way onto the list.
--
-- Two belts, because either one alone leaves the door ajar:
--   1. this migration clears every follower_threshold, so the DB no longer
--      names a class reach can open;
--   2. pickEffectiveClass (same PR) no longer reads the threshold at all, so
--      a threshold re-seeded by hand, or by a reset inserting a MISSING
--      classes row, still cannot reopen it.
--
-- admin_reset_database (latest body: 20260915234029) upserts the classes rows
-- with `on conflict (key) do update set label, rank` — follower_threshold is
-- NOT in that set, and `classes` is a required survivor, so the NULLs written
-- here survive a reset. Its VALUES list still spells 1000/5000/20000 for the
-- insert branch; belt 2 is what makes that harmless.
--
-- STORAGE STAYS. The silver and gold rows are not deleted: consumers.class_key
-- and invitation_class_key FK to this table, and the rewards grid still has
-- their columns (rate math is MESITA-2038's). Nothing can grant them any more
-- — admin-web-grant-class and admin-web-mint-invite-codes accept `diamond`
-- only — so they are unreachable, not removed.
--
-- WHERE clauses on every UPDATE: safeupdate refuses an unqualified one.

update public.classes
   set follower_threshold = null
 where follower_threshold is not null;

-- Re-settle anyone whose slot the reach door was holding. This mirrors
-- recomputeConsumerClass with the reach door gone: an invitation to a live
-- class wins (origin 'invitation'), else the base (bronze / 'default'). Plan
-- is a separate axis and is not touched. Live on 2026-09-22 this matches 0
-- rows (1 consumer, bronze/default) — it is written to be correct anyway,
-- and the EF's own recompute on the next profile read would heal it too.
update public.consumers c
   set class_key = case
         when c.invitation_class_key is not null
          and exists (select 1 from public.classes k
                       where k.key = c.invitation_class_key)
         then c.invitation_class_key
         else 'bronze'
       end,
       class_origin = case
         when c.invitation_class_key is not null
          and exists (select 1 from public.classes k
                       where k.key = c.invitation_class_key)
         then 'invitation'
         else 'default'
       end,
       class_expires_at = null,
       class_granted_at = now()
 where c.class_origin = 'instagram';
