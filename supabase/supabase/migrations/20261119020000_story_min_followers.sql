-- MESITA-4425 — Admin › Configurations › Stories: the follower floor.
--
-- The Story voucher's follower floor was a code constant (1,000). It becomes
-- app_config.money_config.story_min_followers, read by every Story check
-- (_shared/vouchers.ts storyRefusal via storyEligibilityContext) and written
-- only through this RPC, so the page can never overwrite money_config's other
-- keys (buying_paused, sending_live, express_wallets, the Story waits).
--
-- money_config_merge_story(p_patch, p_updated_by):
--   · p_patch must be a JSON object of allowed keys only — anything else is
--     refused (22023), never ignored;
--   · story_min_followers must be a whole JSON number, clamped 0..1,000,000;
--   · merged under a row lock, stamped with the admin, and the Story keys
--     before and after are answered for the EF's log line.
-- Service role only. The emulator keys join the allowed list in MESITA-4426.

update public.app_config
   set money_config = coalesce(money_config, '{}'::jsonb) || jsonb_build_object('story_min_followers', 1000)
 where id = 1 and not (coalesce(money_config, '{}'::jsonb) ? 'story_min_followers');

create or replace function public.money_config_merge_story(p_patch jsonb, p_updated_by uuid default null)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_allowed constant text[] := array['story_min_followers'];
  v_story_keys constant text[] := array['story_min_followers', 'story_bonus_wait_sec', 'story_post_window_sec',
                                        'story_credit_margin_sec', 'story_check_margin_sec', 'story_recheck_meta'];
  v_old jsonb;
  v_new jsonb;
  v_clean jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_num numeric;
  v_at timestamptz;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;
  for v_key, v_val in select * from jsonb_each(p_patch) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'unknown key %', v_key using errcode = '22023';
    end if;
    if jsonb_typeof(v_val) <> 'number' then
      raise exception '% must be a whole number', v_key using errcode = '22023';
    end if;
    v_num := (v_val #>> '{}')::numeric;
    if v_num <> trunc(v_num) then
      raise exception '% must be a whole number', v_key using errcode = '22023';
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, least(greatest(v_num, 0), 1000000)::int);
  end loop;
  if v_clean = '{}'::jsonb then
    raise exception 'nothing to save' using errcode = '22023';
  end if;

  select coalesce(money_config, '{}'::jsonb) into v_old from public.app_config where id = 1 for update;
  if not found then
    raise exception 'app_config missing' using errcode = 'P0002';
  end if;
  update public.app_config
     set money_config = v_old || v_clean,
         updated_by = p_updated_by,
         updated_at = now()
   where id = 1
   returning money_config, updated_at into v_new, v_at;

  return jsonb_build_object(
    'before', (select coalesce(jsonb_object_agg(k, v_old -> k), '{}'::jsonb) from unnest(v_story_keys) k where v_old ? k),
    'after', (select coalesce(jsonb_object_agg(k, v_new -> k), '{}'::jsonb) from unnest(v_story_keys) k where v_new ? k),
    'updated_at', v_at
  );
end;
$function$;

revoke all on function public.money_config_merge_story(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.money_config_merge_story(jsonb, uuid) to service_role;
