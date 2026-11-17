-- MESITA-4249 — VIP at MORE THAN 1,000 followers. Pato, 2026-11-17: "to be
-- VIP you only need more than 1,000 followers". It was 5,000 or more
-- (MESITA-3864). Still a verified Instagram (today the Apify typed-username
-- connect, MESITA-3039). The VIP offer is gone; Class stays.

alter table public.consumers
  alter column guest_class set expression as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_count, 0) > 1000
        then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'Class (MESITA-3850, MESITA-4249): vip exactly when Instagram is verified and has more than 1,000 followers, else regular. Generated; nothing writes it.';
