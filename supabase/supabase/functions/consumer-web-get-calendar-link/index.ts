// Supabase Edge Function — consumer-web-get-calendar-link (product caller)
//
// MESITA-3954, Me › Integrations › Calendar: the signed-in guest's private
// calendar feed link, made on first ask. `reset: true` replaces the token,
// so a link the guest shared by mistake stops working.
//
// Body: { reset?: boolean }
// Response: { ok: true, url: "https://…/consumer-web-get-calendar-feed?token=…" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";

/** 32 random bytes, base64url: 43 characters, unguessable. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(
    /\//g,
    "_",
  ).replace(/=+$/, "");
}

serveJson("consumer-web-get-calendar-link", async (req) => {
  const ctx = await requireConsumerRequest(req, {
    signIn: "Sign in to add your reservations to a calendar.",
  });
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const body = await readJsonOr<{ reset?: boolean }>(req, {});

  let token: string | null = null;
  if (!body.reset) {
    const { data, error } = await admin
      .from("consumer_calendar_feeds")
      .select("token")
      .eq("consumer_id", user.id)
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    token = data?.token ?? null;
  }
  if (!token) {
    token = newToken();
    const { error } = await admin
      .from("consumer_calendar_feeds")
      .upsert({
        consumer_id: user.id,
        token,
        created_at: new Date().toISOString(),
      }, { onConflict: "consumer_id" });
    if (error) return json({ ok: false, error: error.message }, 500);
  }

  const url = `${env.url}/functions/v1/consumer-web-get-calendar-feed?token=${
    encodeURIComponent(token)
  }`;
  return json({ ok: true, url });
});
