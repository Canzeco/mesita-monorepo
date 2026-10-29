-- MESITA-3037: the Instagram DM bot's Meta token stays alive.
--
-- Instagram's long-lived user token lasts 60 days. META_IG_ACCESS_TOKEN
-- seeds it; supabase-cron-refresh-instagram-token refreshes it weekly into
-- this one-row table, and meta-instagram-receive-message reads it first.
-- EF-only: RLS on, no policy, no client grants.

create table if not exists public.meta_instagram_token (
  id boolean primary key default true check (id),
  access_token text not null,
  expires_at timestamptz,
  refreshed_at timestamptz not null default now()
);

alter table public.meta_instagram_token enable row level security;
revoke all on public.meta_instagram_token from anon, authenticated;

comment on table public.meta_instagram_token is
  'The Instagram DM bot''s current Meta user token, refreshed weekly by supabase-cron-refresh-instagram-token (MESITA-3037). One row. EF-only.';

-- A reset must not drop the refreshed token: the seed secret may be past
-- its 60 days by then.
insert into public.admin_reset_preserve (table_name, reason) values
  ('meta_instagram_token', 'Instagram DM bot token; the seed secret expires 60 days after it was set (MESITA-3037)')
on conflict (table_name) do update set reason = excluded.reason;

select cron.unschedule('refresh-instagram-token')
where exists (select 1 from cron.job where jobname = 'refresh-instagram-token');

select cron.schedule(
  'refresh-instagram-token',
  '17 4 * * 1',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-refresh-instagram-token',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
