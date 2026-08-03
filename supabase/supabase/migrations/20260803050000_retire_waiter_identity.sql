-- MESITA-833 — retire the waiter identity.
--
-- The waiter is not a Mesita user. Staff handle tickets on the public check
-- page (mesita.ai/check/<code>, check-web-*, verify_jwt = false) where
-- possession of the 128-bit check_code IS the authentication. There is no
-- waiter account, no waiter invite, no phone-pool onboarding, no PIN.
--
-- So every object that exists to give a waiter an IDENTITY goes, along with
-- the rail that depended on one (staff WhatsApp — its access check read
-- project_roles, and its session bootstrap raised "staff has no
-- project_roles"). The matching Edge Functions are deleted in the same PR:
-- business-web-invite-staff, business-web-test-staff-channel,
-- business-whats-handle-message, and the _shared/staff-{invite,whatsapp,llm,
-- place-ops,bill-draft}-* cluster.
--
-- Loss-free: all four tables were verified 0 rows on the live singleton
-- before this migration was written, and nothing references them (every FK
-- on them is OUTBOUND — to auth.users / projects / tickets / consumers — so
-- no dependent table blocks the drop).
--
-- NOT touched: the story_status legacy 'waiter_verified' enum value (renamed
-- to 'staff_verified' by the r1 rename, old value kept for tolerance). It is
-- about story verification on the check page, which still exists.
--
-- Business members (project_members / member_role owner|editor|viewer) are
-- untouched — that is the business console's own team, not waiters.

-- 1 — the waiter identity tables.
drop table if exists public.staff_whatsapp_messages cascade;
drop table if exists public.staff_whatsapp_sessions cascade;
drop table if exists public.staff_invites          cascade;
drop table if exists public.project_roles          cascade;

-- 2 — project_role ('staff','business') was used by exactly one column,
--     project_roles.role, which just went with the table.
drop type if exists public.project_role;

-- 3 — admin_reset_database: drop the four tables from the truncate list.
--     Patched SURGICALLY off the live definition (never re-declared from a
--     repo copy — that is exactly how a stub once clobbered prod). Fails
--     loudly if an anchor is not found verbatim.
do $patch$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid)
    into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'admin_reset_database';

  if def is null then
    raise exception 'admin_reset_database not found';
  end if;

  if position('public.project_roles' in def) = 0
     and position('public.staff_invites' in def) = 0
     and position('public.staff_whatsapp_sessions' in def) = 0
     and position('public.staff_whatsapp_messages' in def) = 0 then
    -- Already patched (re-run safety).
    return;
  end if;

  patched := replace(
    def,
    E'    public.staff_whatsapp_messages,\n    public.staff_whatsapp_sessions,\n',
    ''
  );
  patched := replace(
    patched,
    E'    public.staff_invites,\n    public.project_roles,\n',
    ''
  );

  if patched = def then
    raise exception 'admin_reset_database truncate anchors not found — inspect live body before patching';
  end if;

  -- Belt and braces: the function must not name a table that no longer exists,
  -- or the next reset raises at runtime instead of here.
  if position('public.project_roles' in patched) > 0
     or position('public.staff_invites' in patched) > 0
     or position('public.staff_whatsapp_sessions' in patched) > 0
     or position('public.staff_whatsapp_messages' in patched) > 0 then
    raise exception 'admin_reset_database still references a dropped waiter table after patching';
  end if;

  execute patched;
end
$patch$;
