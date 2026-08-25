// Supabase Edge Function — supabase-edgefunc-get-consumer-context (internal caller)
//
// Memo's persona clause for a signed-in consumer. One of the four endpoints
// that make up Memo's entire data surface (see _shared/memo-data.ts); Memo
// itself holds no database client.
//
// It returns a SENTENCE FRAGMENT, not a profile: "named Ana, 28 years old,
// female". Composing it here rather than in the agent is the point — the raw
// row (full name, birthday, sex) is read, reduced, and dropped inside this
// function, so those fields never cross the wire into a model context at all.
// Age is derived; the birthday itself is never exposed.
//
// The clause is keyed by auth user id supplied by the CALLER (an authenticated
// consumer EF, or the admin playground naming a persona to speak as) — never by
// a model-supplied parameter. Memo's airlock has no tool that reaches this.
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · get · consumer-context.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import {
  ageFromBirthday,
  composeProfileClause,
} from "../_shared/memo-consumer-context.ts";

type Body = { userId?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const callerRes = requireInternalCaller(req, envRes.env);
  if (!callerRes.ok) return callerRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const userId = typeof bodyRes.body.userId === "string"
    ? bodyRes.body.userId.trim()
    : "";
  if (!userId) return json({ ok: false, error: "userId is required" }, 400);

  // A profile miss must never sink Memo's answer — it just means no persona
  // clause. Same contract the direct read had before this EF existed.
  try {
    const admin = adminClient(envRes.env);
    const { data, error } = await admin
      .from("consumers")
      .select("first_name, full_name, sex, birthday, deleted_at")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data || data.deleted_at) {
      if (error) console.error("[get-consumer-context] read:", error.message);
      return json({ ok: true, clause: null, caller: callerRes.callerName });
    }
    const clause = composeProfileClause(
      (data.first_name ?? data.full_name ?? "") as string,
      ageFromBirthday(data.birthday),
      (data.sex ?? "") as string,
    );
    return json({ ok: true, clause, caller: callerRes.callerName });
  } catch (e) {
    console.error("[get-consumer-context] threw:", (e as Error).message);
    return json({ ok: true, clause: null, caller: callerRes.callerName });
  }
});
