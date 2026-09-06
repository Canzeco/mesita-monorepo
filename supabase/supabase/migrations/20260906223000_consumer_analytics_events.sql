-- MESITA-1387 — the consumer app had zero instrumentation. First four
-- events (nav_tab_tap, wallet_open, balance_card_tap, ticket_created) land
-- here rather than a third-party vendor: no account to create, no key to
-- hand an agent, and the volume today is nothing (consumers=1). A real
-- vendor is a swap-in later if the volume ever justifies one; this table is
-- the whole pipeline until then.

create table public.consumer_analytics_events (
  id          uuid primary key default gen_random_uuid(),
  consumer_id uuid references auth.users(id) on delete set null,
  event       text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.consumer_analytics_events is
  'Consumer-app product events (MESITA-1387). EF-only; no client ever reads this back. consumer_id is provenance, not identity — nulled if the account is deleted.';

create index consumer_analytics_events_event_idx
  on public.consumer_analytics_events (event, created_at desc);

alter table public.consumer_analytics_events enable row level security;
-- No policies — deliberate lockdown, same as every other EF-only table.
revoke all on table public.consumer_analytics_events from public, anon, authenticated;
grant all on table public.consumer_analytics_events to service_role;
