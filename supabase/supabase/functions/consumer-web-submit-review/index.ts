// Supabase Edge Function — consumer-web-submit-review
//
// A Google review is not a Member Reward. This endpoint used to self-verify
// a screenshot, claim once-per-place, reprice the ticket, and queue Ojo.
// It now refuses every call and writes nothing. Visit verification and a
// private Mesita review stay on their own endpoints.
//
// Body:     { ticketId?: string, screenshotUrl?: string } (ignored)
// Response: { ok: false, code: "not_rewarded", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { getAuthedUser, readEFEnv } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;
  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  return json(
    {
      ok: false,
      code: "not_rewarded",
      error:
        "A Google review is not part of Member Rewards. Visit verification and a private Mesita review are.",
    },
    409,
  );
});
