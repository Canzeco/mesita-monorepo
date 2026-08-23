-- MESITA-1248: auto_verify_video was dead config — no code path ever read it.
-- admin-web-list-verifications always showed every video row regardless of
-- the flag, and the admin console never rendered a control for it. The
-- writer/reader EFs (admin-web-{get,update}-verification-config,
-- admin-web-get-config) and the orphaned admin-web-set-auto-verify EF are
-- retired in the same PR.
alter table public.app_config drop column if exists auto_verify_video;
