-- Renaming a base column does NOT rename the view's output alias. Postgres
-- rewrites the view's internal reference to follow the base column, but the
-- name the view PUBLISHES is fixed at creation time. So after 20260818092000
-- the base table and the view disagreed:
--
--   projects.discount_cap_cents   <->  profiles.reward_cap_cents
--   projects.plan_live_at         <->  profiles.membership_live_at
--   projects.plan_forfeited_at    <->  profiles.membership_forfeited_at
--
-- This is not cosmetic. profiles_insert / profiles_update are INSTEAD OF
-- triggers whose NEW record is a PROFILES row, and 20260818092000 rewrote
-- `new.reward_cap_cents` to `new.discount_cap_cents` along with the base-table
-- reference. Until the view publishes the new name, that reference does not
-- resolve and every write through the view fails at runtime.
--
-- Renaming the view's columns fixes both halves at once: the published name
-- matches the base table, and the trigger's NEW reference resolves.

alter view public.profiles rename column reward_cap_cents        to discount_cap_cents;
alter view public.profiles rename column membership_live_at      to plan_live_at;
alter view public.profiles rename column membership_forfeited_at to plan_forfeited_at;
