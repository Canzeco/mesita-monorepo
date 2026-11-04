// Supabase Edge Function — consumer-web-list-reward-percents
//
// MESITA-3217: the Reward tab's "Up to N% off for you". For each place asked
// about, the sum of what this guest qualifies for there (place_rewards_for_guest:
// Welcome or Returning, Story, VIP). A place with nothing on is left out, so the
// row shows no amount: the number is what the till would really give, never a
// promise the place did not make.
//
// Body: { place_ids: uuid[] }, at most 100
// Response: { ok: true, percents: { [place_id]: number } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";

const MAX_PLACES = 100;

serveJson("consumer-web-list-reward-percents", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const ids = bodyRes.body.place_ids;
  if (!Array.isArray(ids) || ids.length > MAX_PLACES || !ids.every(isUuid)) {
    return json({ ok: false, error: `place_ids must be at most ${MAX_PLACES} Mesita place ids` }, 400);
  }
  if (ids.length === 0) return json({ ok: true, percents: {} });

  const admin = adminClient(envRes.env);
  // Most places have no row, so only the ones that do cost a read per guest.
  const { data: rows, error } = await admin.from("place_rewards").select("place_id").in("place_id", ids);
  if (error) return json({ ok: false, error: `place_rewards: ${error.message}` }, 500);

  const percents: Record<string, number> = {};
  const answers = await Promise.all(
    (rows ?? []).map(async ({ place_id: placeId }) => {
      const res = await admin.rpc("place_rewards_for_guest", { p_place_id: placeId, p_consumer_id: authRes.user.id });
      return { placeId, ...res };
    }),
  );
  for (const { placeId, data, error: rpcError } of answers) {
    if (rpcError) return json({ ok: false, error: rpcError.message }, 500);
    const sum = ((data ?? []) as { percent: number; eligible: boolean }[])
      .reduce((total, r) => (r.eligible ? total + r.percent : total), 0);
    if (sum > 0) percents[placeId] = sum;
  }
  return json({ ok: true, percents });
});
