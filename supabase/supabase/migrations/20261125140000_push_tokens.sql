-- MESITA-4938: this install's push token. The guest id comes from the
-- session, never the body. One row per guest and install. EF-only.

create table public.consumer_push_tokens (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  install_id text not null check (char_length(install_id) between 1 and 80),
  token text not null check (char_length(token) between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key (consumer_id, install_id)
);

comment on table public.consumer_push_tokens is
  'MESITA-4938: Expo push token for one install of one guest. EF-only.';

alter table public.consumer_push_tokens enable row level security;
revoke all on table public.consumer_push_tokens from public, anon, authenticated;
grant all on table public.consumer_push_tokens to service_role;

-- One send per reservation outcome. attempts stops at 3. The token is not stored.
create table public.consumer_push_sends (
  reservation_id uuid not null,
  outcome text not null check (char_length(outcome) between 1 and 40),
  attempts int not null default 0 check (attempts between 0 and 3),
  sent_at timestamptz,
  primary key (reservation_id, outcome)
);

comment on table public.consumer_push_sends is
  'MESITA-4938: how many times this reservation outcome was offered to Expo. No token, no amount.';

alter table public.consumer_push_sends enable row level security;
revoke all on table public.consumer_push_sends from public, anon, authenticated;
grant all on table public.consumer_push_sends to service_role;
