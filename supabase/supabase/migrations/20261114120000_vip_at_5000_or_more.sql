-- MESITA-3864 — VIP at 5,000 followers or more. Pato, 2026-11-14: "5000 or
-- more, not 5001 is the number". MESITA-3850 set the bar at more than 5,000.

alter table public.consumers
  alter column guest_class set expression as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_count, 0) >= 5000
        then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'Class (MESITA-3850, MESITA-3864): vip exactly when Instagram is verified and has 5,000 followers or more, else regular. Generated; nothing writes it.';
