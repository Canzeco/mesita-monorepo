-- Phone-based super-admin allowlisting.
--
-- The admin console historically authenticated operators via Google OAuth
-- and matched public.super_admins by email (the table PK). We now also
-- support phone-OTP sign-in for the admin console, so the allowlist must
-- match on phone too. `email` stays the PK; a phone-OTP operator gets a
-- synthetic placeholder email (to satisfy the PK + email CHECK) plus their
-- phone in the new column, and checkSuperAdmin() (EF _shared/auth.ts)
-- matches on EITHER identity the session carries (email or phone).

alter table public.super_admins
  add column if not exists phone text;

comment on column public.super_admins.phone is
  'E.164 without the leading + (matches auth.users.phone). Set for operators who sign in via phone OTP instead of Google OAuth.';

create unique index if not exists super_admins_phone_key
  on public.super_admins (phone)
  where phone is not null;

-- Seed the phone-OTP admin (+52 444 549 9597). user_id is left null and
-- lazily backfilled by checkSuperAdmin() on first sign-in, so the row
-- carries no environment-specific auth.users dependency.
insert into public.super_admins (email, phone, note)
values (
  'admin-524445499597@phone.mesita.local',
  '524445499597',
  'Phone-OTP admin (+52 444 549 9597)'
)
on conflict (email) do nothing;
