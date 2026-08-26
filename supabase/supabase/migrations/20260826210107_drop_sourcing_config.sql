-- MESITA-1363: Sourcing matrix is gone. Search/Add eligibility is Discovery › Map.
alter table public.app_config drop column if exists sourcing_config;
