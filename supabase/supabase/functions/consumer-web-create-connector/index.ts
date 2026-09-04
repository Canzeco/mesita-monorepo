// Supabase Edge Function — consumer-web-create-connector (product caller)
//
// Authenticated. Mints a Consumer MCP personal access token for the caller.
// Plaintext is returned ONCE in the response; only sha256 is stored.
//
// Body: { label?: string }
// Response: { ok: true, token: { id, token, token_prefix, label, created_at, mcp_url } }
//
// Deploy: supabase functions deploy consumer-web-create-connector

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { mintMcpTokenPlaintext } from "../_shared/mcp-tokens.ts";
import { isPremiumPlan } from "../_shared/membership.ts";

type Body = { label?: string };

function mcpUrl(envUrl: string): string {
  // Streamable HTTP MCP endpoint hosted as an Edge Function.
  return `${envUrl.replace(/\/$/, "")}/functions/v1/consumer-mcp`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const body = await readJsonOr<Body>(req, {});
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 80)
      : "AI client";

  const admin = adminClient(envRes.env);

  // decision: Pato — Consumer MCP is Premium-only (MESITA-266).
  const { data: consumerRow, error: consumerErr } = await admin
    .from("consumers")
    .select("class_key, plan")
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerErr) {
    return json({ ok: false, error: `consumer_read: ${consumerErr.message}` }, 500);
  }
  if (!isPremiumPlan(consumerRow?.class_key, consumerRow?.plan)) {
    return json(
      {
        ok: false,
        error: "AI connect requires Mesita Premium",
        code: "mcp_premium_required",
      },
      403,
    );
  }

  // Cap active tokens per consumer so a buggy client can't mint forever.
  const { count, error: countErr } = await admin
    .from("consumer_connectors")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .is("revoked_at", null);
  if (countErr) {
    return json({ ok: false, error: `token_count: ${countErr.message}` }, 500);
  }
  if ((count ?? 0) >= 10) {
    return json(
      {
        ok: false,
        error: "Too many active MCP tokens — revoke one before minting another",
        code: "mcp_token_limit",
      },
      429,
    );
  }

  const minted = await mintMcpTokenPlaintext();
  const { data, error } = await admin
    .from("consumer_connectors")
    .insert({
      consumer_id: consumerId,
      token_prefix: minted.prefix,
      token_hash: minted.hash,
      label,
    })
    .select("id, token_prefix, label, created_at")
    .single();

  if (error) {
    return json({ ok: false, error: `token_insert: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    token: {
      id: data.id,
      // Plaintext — shown once. Never persisted or re-fetched.
      token: minted.plaintext,
      token_prefix: data.token_prefix,
      label: data.label,
      created_at: data.created_at,
      mcp_url: mcpUrl(envRes.env.url),
    },
  });
});
