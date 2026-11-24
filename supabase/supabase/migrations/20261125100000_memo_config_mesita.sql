-- MESITA-4927: the AI has no name of its own; it presents itself as Mesita (was
-- "Mesi"). The greeting is served live from app_config.memo_config.greeting (no
-- editor exists) and must equal the fallback in
-- apps/web-consumer/src/components/consumer/search/ask-ai-thread.ts.
-- A fresh database (no row) is a no-op.
do $$
declare
  n integer;
  greeting constant text :=
    'Hola, soy Mesita. Dime qué se te antoja — prueba “rooftop date tonight” o “tacos al pastor”.';
begin
  update public.app_config
     set memo_config = jsonb_set(
           jsonb_set(memo_config, '{greeting}', to_jsonb(greeting)),
           '{instructions}',
           to_jsonb(regexp_replace(replace(coalesce(memo_config->>'instructions', ''),
             'You are Mesi, the agent of Mesita (he/him)', 'You are Mesita, the AI of the Mesita app'),
             '\mMesi\M', 'Mesita', 'g')))
   where id = 1;
  get diagnostics n = row_count;
  if n = 1 and exists (
    select 1 from public.app_config
     where id = 1
       and (memo_config->>'greeting' is distinct from greeting
            or memo_config->>'instructions' ~ '\mMesi\M')
  ) then
    raise exception 'MESITA-4927: memo_config still names Mesi';
  end if;
end $$;
