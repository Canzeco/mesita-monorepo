-- agents_config on the app_settings singleton: runtime knobs for the
-- eleven-agent-* caller family (the Reservationist's mid-call server tools).
-- toolSecret is the shared header secret the ElevenLabs agent sends as
-- `x-agent-secret` on every tool webhook; it lives in the DB (not EF env) so
-- it can be rotated with plain SQL. Seeded once with a random 64-hex value;
-- re-running never overwrites an existing secret.
alter table public.app_settings
  add column if not exists agents_config jsonb not null default '{}'::jsonb;

update public.app_settings
  set agents_config = jsonb_set(
    agents_config,
    '{toolSecret}',
    to_jsonb(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  )
  where id = 1 and (agents_config->>'toolSecret') is null;
