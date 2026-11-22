-- MESITA-4662 — The Instagram follower emulator. Pato, 2026-11-22: "here in
-- instagram for the moment add an emulator box to emulate public instagram
-- with +x followers". Privacy is gone (MESITA-4659), so it emulates the
-- follower count only.
--
-- 1. consumers.instagram_followers_emulated: null = real count; a number
--    stands in for the real count in the Class. Only consumer-web-update-profile
--    writes it, and only while payments run in Stripe test mode (403
--    emulator_live otherwise); clearing it (Reset to real) is always allowed.
-- 2. guest_class: a verified Instagram whose emulated count, else real count,
--    is more than 5,000 is VIP. The money gate (vouchers.ts vipRefusal) never
--    trusts an emulated count in live mode: it re-reads the real one.
--
-- Rollback: 20261122200000's guest_class expression; drop the column.

alter table public.consumers
  add column instagram_followers_emulated integer
  constraint consumers_instagram_followers_emulated_check
    check (instagram_followers_emulated between 0 and 100000000);

comment on column public.consumers.instagram_followers_emulated is
  'MESITA-4662: the follower emulator on Me › Instagram. null = the real count counts; a number stands in for it in guest_class. Written only in Stripe test mode (consumer-web-update-profile); live money ignores it (vouchers.ts vipRefusal).';

alter table public.consumers
  alter column guest_class set expression as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_emulated, instagram_followers_count, 0) > 5000
        then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'Class (MESITA-3850, MESITA-4639, MESITA-4659, MESITA-4662): vip exactly when Instagram is verified and has more than 5,000 followers (the emulated count when set, else the real one), else regular; privacy does not count. Generated; nothing writes it. A VIP claim also needs the count read within the hour, and live money ignores an emulated count (vouchers.ts).';
