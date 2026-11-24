-- MESITA-4849 — VIP IS BY INVITATION CODE ONLY until the Instagram DM bot
-- (MESITA-2579) proves who owns an account. Pato, 2026-11-24: "Yes, codes
-- only". Me › Instagram trusts a typed username, so anyone could type a famous
-- account and be paid as VIP. Followers, real or emulated, no longer make a
-- VIP, on screens or for money. Nobody loses a code-made VIP.
--
-- p_livemode stays in the signature: every caller passes it, and follower VIP
-- (live counts real followers only) returns with the bot.
--
-- Rollback: both bodies from 20261123230000_vip_back_stories_out.sql.

alter table public.consumers
  alter column guest_class set expression as (
    case when vip_invited_at is not null then 'vip' else 'regular' end
  );

comment on column public.consumers.guest_class is
  'MESITA-4849: vip when an invitation code made the guest VIP (vip_invited_at), else regular. Instagram followers do not count until the DM bot proves ownership. What screens show. Money asks consumer_is_vip_for_money.';

create or replace function public.consumer_is_vip_for_money(p_consumer uuid, p_livemode boolean)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select c.vip_invited_at is not null
      from public.consumers c
     where c.id = p_consumer
  ), false);
$function$;
revoke all on function public.consumer_is_vip_for_money(uuid, boolean) from public, anon, authenticated;
grant execute on function public.consumer_is_vip_for_money(uuid, boolean) to service_role;
comment on function public.consumer_is_vip_for_money(uuid, boolean) is
  'MESITA-4849: whether this guest is paid as VIP: invited by code only, in live and test mode. The one rule the cashback trigger, placeCashbackFor and admin read.';
