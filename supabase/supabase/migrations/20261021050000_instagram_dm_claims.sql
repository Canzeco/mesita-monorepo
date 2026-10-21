-- MESITA-2575 — verify Instagram by DM.
--
-- The guest sends @mesita their one-time code on Instagram; Meta's message
-- webhook (meta-instagram-receive-message) finds the claim by its code and
-- learns the handle, follower count and photo from Meta's User Profile API.
-- So a DM claim has no handle until it is proved: `handle` may be null
-- (null = a DM claim; set = the bio-code claim of MESITA-2461, which stays as
-- the fallback until the Meta secrets exist). The existing CHECK on `handle`
-- passes a null.
--
-- The webhook looks a claim up by its code, so codes are unique.
--
-- Live data at write time: 0 pending claims.

alter table public.consumer_instagram_claims
  alter column handle drop not null;

create unique index if not exists consumer_instagram_claims_code_key
  on public.consumer_instagram_claims (code);

comment on table public.consumer_instagram_claims is
  'A pending Instagram claim and its one-time code. handle set = the bio-code claim (MESITA-2461: the code goes in the bio, the server reads it there); handle null = a DM claim (MESITA-2575: the guest sends the code to Mesita on Instagram and the webhook learns the handle from Meta). EF-only (RLS, no policies; client privileges revoked).';
