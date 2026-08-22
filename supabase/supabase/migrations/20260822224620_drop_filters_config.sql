-- Discovery teardown (MESITA-1183): drop the consumer discovery-filter policy.
--
-- The column was added 2026-08-17 and shipped STAGED — its own comment said so
-- ("no consumer reads it yet"). That never changed: at teardown time a grep
-- across apps/web-consumer, apps/mobile-consumer and every Edge Function found
-- exactly two readers, `admin-web-get-filters-config` and
-- `admin-web-update-filters-config`, both deleted in this same change. Nothing
-- a guest can see depends on this column, so dropping it is invisible.
--
-- Discovery is being rebuilt as seven scoring signals + eight engines
-- (MESITA-1196/1197). That rebuild gets its own storage; it deliberately does
-- NOT inherit this blob, whose shape encoded the old six-filter-module model.
--
-- NOTE the table: `app_config`, not `app_settings`. The original filters_config
-- migration (20260817030000) named app_settings, which has since been renamed —
-- writing this against the old name would have failed at apply time.

alter table public.app_config
  drop column if exists filters_config;
