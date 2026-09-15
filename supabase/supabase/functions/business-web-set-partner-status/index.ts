// Supabase Edge Function — business-web-set-partner-status
//
// The OPERATOR's door onto a place's Partner switch (MESITA-1798, re-scoped
// by MESITA-1892). It writes `places.partnered` and the plan patch that
// rides with it, and nothing else.
//
// Body: { placeId, partnered: boolean }
// Response: { ok: true, partnered, joined, dropped }
//
// NAMED `set-partner-status`, NOT `set-place-partnership`. The repo already
// has `business-web-set-partnership`, which is a DIFFERENT door: the place's
// plan and rate strategy (join / drop / strategy switch). Two money doors one
// letter apart is how the wrong one gets edited, so this one is named after
// the bit it owns — the `partnered` fact — and the other keeps its name.
//
// IT USED TO BE business-web-set-org-partnership. Partner was an organization
// fact that CASCADED onto every held place, so the response counted
// `placesJoined` / `placesDropped`. There is one place now, so the counts
// become the two booleans `joined` / `dropped`: flipping to the current value
// is legal and must be able to say that nothing moved.
//
// IT NO LONGER RETURNS OR WRITES `mesitaPayEnabled`. There were two Mesita Pay
// bits — the organization's and the place's — and `profiles.mesita_pay_enabled`
// ANDed them; this switch owned the org's half. MESITA-1892 collapsed them into
// one column on `place_profiles` with exactly ONE writer, `_shared/place-rails.ts`.
// A second writer for one bit is how a switch and a page end up disagreeing
// about what is on.
//
// Turning ON still refuses unless the place's Connect account is charge-ready
// (code stripe_not_ready). That lock is KEPT ON PURPOSE even though the Pay
// coupling it guarded is gone: loosening a money gate is not this issue's
// business, and a Partner is a merchant that can take a charge.
//
// Auth: requireOwner on the place — same rank as Connect Stripe.
//
// Local:  supabase functions serve business-web-set-partner-status
// Deploy: supabase functions deploy business-web-set-partner-status

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOwner } from "../_shared/auth-membership.ts";
import { setPlacePartnership } from "../_shared/place-partnership.ts";

type Body = { placeId?: unknown; projectId?: unknown; partnered?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (typeof bodyRes.body.partnered !== "boolean") {
    return json({ ok: false, error: "partnered must be a boolean" }, 400);
  }

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(admin, authRes.user, placeId);
  if (!ownerRes.ok) return ownerRes.response;

  const result = await setPlacePartnership(admin, placeId, bodyRes.body.partnered);
  if (!result.ok) {
    return json(
      { ok: false, code: result.code, error: result.error },
      result.status,
    );
  }
  return json({
    ok: true,
    partnered: result.partnered,
    joined: result.joined,
    dropped: result.dropped,
  });
});
