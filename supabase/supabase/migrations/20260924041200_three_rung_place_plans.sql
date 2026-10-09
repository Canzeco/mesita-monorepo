-- MESITA-2020 — three-rung ladder vocabulary: Free · Pro (MX$200/mo) · Ultra (MX$2,000/mo).

insert into public.place_plans (key, label, price_cents, currency) values
  ('free', 'Free', 0, 'MXN')
on conflict (key) do update set
  label = excluded.label,
  price_cents = excluded.price_cents,
  currency = excluded.currency;

update public.place_plans
   set label = 'Pro', price_cents = 20000, currency = 'MXN'
 where key = 'pro';

update public.place_plans
   set label = 'Ultra', price_cents = 200000, currency = 'MXN'
 where key = 'ultra';

delete from public.place_plans where key = 'start';

-- Keep admin_reset_database's place_plans seed aligned (surgical patch).
do $patch$
declare
  src text;
  patched text;
  old_seed text := $old$
  insert into public.place_plans (key, label, price_cents, currency) values
    ('pro',   'Partner', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;$old$;
  new_seed text := $new$
  insert into public.place_plans (key, label, price_cents, currency) values
    ('free',  'Free',       0, 'MXN'),
    ('pro',   'Pro',    20000, 'MXN'),
    ('ultra', 'Ultra', 200000, 'MXN')
  on conflict (key) do update set
    label = excluded.label,
    price_cents = excluded.price_cents,
    currency = excluded.currency;

  delete from public.place_plans where key = 'start';$new$;
begin
  select pg_get_functiondef(oid) into src
  from pg_proc
  where proname = 'admin_reset_database'
    and pronamespace = 'public'::regnamespace;

  if src is null then
    raise exception 'admin_reset_database not found';
  end if;

  patched := replace(src, old_seed, new_seed);

  if patched = src then
    raise exception 'admin_reset_database place_plans patch target not found — function text drifted';
  end if;

  execute patched;
end;
$patch$;

notify pgrst, 'reload schema';
