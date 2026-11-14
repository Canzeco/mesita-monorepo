// Supabase Edge Function — consumer-web-get-mcp-link (product caller)
//
// MESITA-3971, Me › Integrations › MCP: the signed-in guest's private
// connector URL for Claude and ChatGPT, made on first ask. `reset: true`
// replaces the token, so a link shared by mistake stops working.
//
// Body: { reset?: boolean }
// Response: { ok: true, url, last_used_at }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { newLinkToken } from "../_shared/link-token.ts";

serveJson("consumer-web-get-mcp-link", async (req) => {
  const ctx = await requireConsumerRequest(req, {
    signIn: "Sign in to connect Mesita to Claude or ChatGPT.",
  });
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const body = await readJsonOr<{ reset?: boolean }>(req, {});

  let token: string | null = null;
  let lastUsedAt: string | null = null;
  if (!body.reset) {
    const { data, error } = await admin
      .from("consumer_mcp_links")
      .select("token, last_used_at")
      .eq("consumer_id", user.id)
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    token = data?.token ?? null;
    lastUsedAt = data?.last_used_at ?? null;
  }
  if (!token) {
    token = newLinkToken();
    const { error } = await admin
      .from("consumer_mcp_links")
      .upsert({
        consumer_id: user.id,
        token,
        created_at: new Date().toISOString(),
        last_used_at: null,
      }, { onConflict: "consumer_id" });
    if (error) return json({ ok: false, error: error.message }, 500);
  }

  return json({
    ok: true,
    url: `${env.url}/functions/v1/consumer-web-mcp/${token}`,
    last_used_at: lastUsedAt,
  });
});
