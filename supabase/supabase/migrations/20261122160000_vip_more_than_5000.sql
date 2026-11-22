-- MESITA-4639 — VIP is back at MORE THAN 5,000 followers, still verified and
-- PUBLIC (MESITA-4263). Pato, 2026-11-22: "WE ARE GOING TO RETURN VIP CLASS IF
-- MORE THAN 5000 FOLLOWERS." The bar was 1,000 (MESITA-4249); 0 guests were VIP
-- when this ran, so no one loses the class.
--
-- The literal 5000 matches VIP_MIN_FOLLOWERS in _shared/guest-standing.ts; a
-- deno test reads this file and pins the two together. A generated column
-- cannot read config, so the bar lives here.
--
-- Rollback: the same statement with `> 1000` (20261117150000).

alter table public.consumers
  alter column guest_class set expression as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_count, 0) > 5000
       and instagram_is_private = false
        then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'Class (MESITA-3850, MESITA-4263, MESITA-4639): vip exactly when Instagram is verified, has more than 5,000 followers and is public, else regular. Generated; nothing writes it.';
