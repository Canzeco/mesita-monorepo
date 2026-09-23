-- credit_lots.place_id never changes (MESITA-2051).
--
-- RULE 1 OF THE CROSS-VENUE MODEL (Pato, 2026-09-22): "you cannot send
-- credits between wallets of yours of different places even if the same
-- franchise." A lot is a debt the place that SOLD it owes the guest, and that
-- place was paid for it: a direct charge on its own Stripe account
-- (MESITA-1676/1892). Re-pointing the row would hand the debt to a place that
-- never received the money. Nothing writes place_id after the MESITA-1892
-- backfill; this turns that habit into a law the database enforces.
--
-- ONLY place_id. Spends (spent_cents), gift claim and cancel (consumer_id)
-- and every other column stay writable: the trigger is `before update of
-- place_id` and the WHEN clause skips a no-op `set place_id = place_id`.
--
-- THE ESCAPE HATCH. An operator correction is a refund (reverse_credit_lot),
-- and the guest buys again at the other place. A migration that genuinely
-- must bulk-move lots disables and re-enables this trigger inside its own
-- transaction, and says why in its header.
--
-- 23514 (check_violation) on purpose: it is the same class a CHECK raises, so
-- a caller already handling constraint failures handles this one too.

create or replace function public.credit_lots_place_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'credit_lots.place_id is immutable: a lot belongs to the place that sold it. To move value, refund the lot; the guest buys at the other place.'
    using errcode = '23514';
end
$function$;

comment on function public.credit_lots_place_immutable() is
  'Refuses any change to credit_lots.place_id: a lot is owed by the place that sold it, so Credits never move between places, not even between two places of one owner (MESITA-2051). Correction path: refund the lot; the guest buys at the other place.';

create trigger credit_lots_place_immutable
  before update of place_id on public.credit_lots
  for each row
  when (old.place_id is distinct from new.place_id)
  execute function public.credit_lots_place_immutable();

comment on trigger credit_lots_place_immutable on public.credit_lots is
  'Rule 1 of the cross-venue Credits model (MESITA-2051): place_id is fixed at issue. Spends and gift claims update other columns and are unaffected.';
