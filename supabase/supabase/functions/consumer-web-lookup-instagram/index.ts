// Supabase Edge Function — consumer-web-lookup-instagram (product caller)
//
// MESITA-3038: Me › Instagram's lookup while the DM channel is off. The guest
// types a username and says "This is my Instagram account"; this answers who
// that username is: { username, profilePictureUrl, followerCount }.
//
// EMULATED until Meta Business verification lands. The answer comes from
// readInstagramLookup() (_shared/instagram-lookup.ts), today the emulator:
// a predictable sample, `source: "emulator"`, nothing fetched. It is a
// READ-ONLY preview: nothing is stored, the account is not connected or
// verified, Social never sees it. Connecting stays proof
// (consumer-web-claim-instagram).
//
// Body: { username: string, confirmed: true }
// Response: { ok: true, source: "emulator", profile }
//   400 invalid_username · 400 not_confirmed · 404 profile_not_found

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
  serveJson,
} from "../_shared/http.ts";
import { getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { normalizeHandle } from "../_shared/instagram-claim.ts";
import { readInstagramLookup } from "../_shared/instagram-lookup.ts";

type Body = { username?: unknown; confirmed?: unknown };

serveJson("consumer-web-lookup-instagram", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { body } = bodyRes;

  const username = normalizeHandle(body.username);
  if (!username) {
    return json({
      ok: false,
      error: "Enter a valid Instagram username.",
      code: "invalid_username",
    }, 400);
  }
  if (body.confirmed !== true) {
    return json({
      ok: false,
      error: "Confirm this is your Instagram account.",
      code: "not_confirmed",
    }, 400);
  }

  const provider = readInstagramLookup();
  const result = await provider.lookup(username);
  if (!result.ok) {
    return json({
      ok: false,
      error: `We couldn’t find @${username}.`,
      code: "profile_not_found",
    }, 404);
  }
  return json({ ok: true, source: provider.source, profile: result.profile });
});
