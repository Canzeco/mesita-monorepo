-- MESITA-4620: the chat persona is Mesi (was "Don Memo"). The Ask AI greeting
-- is served live from app_config.memo_config.greeting (no editor exists), so
-- the repo changes it here; it must equal the code fallback in
-- apps/web-consumer/src/components/consumer/search/ask-ai-thread.ts.
-- memo_config.instructions is no longer served; renamed too so a revived
-- fallback cannot say Memo. A fresh database (no row) is a no-op.
do $$
declare
  n integer;
  greeting constant text :=
    'Hola, soy Mesi, el agente de Mesita. Dime qué se te antoja — prueba “rooftop date tonight” o “tacos al pastor”.';
begin
  update public.app_config
     set memo_config = jsonb_set(
           jsonb_set(memo_config, '{greeting}', to_jsonb(greeting)),
           '{instructions}',
           to_jsonb(replace(replace(coalesce(memo_config->>'instructions', ''),
             'You are Memo, the AI of Mesita', 'You are Mesi, the agent of Mesita (he/him)'),
             'Don Memo', 'Mesi')))
   where id = 1;
  get diagnostics n = row_count;
  if n = 1 and exists (
    select 1 from public.app_config
     where id = 1
       and (memo_config->>'greeting' is distinct from greeting
            or memo_config->>'instructions' like '%Memo,%')
  ) then
    raise exception 'MESITA-4620: memo_config still names Memo';
  end if;
end $$;
