// Supabase Edge Function — consumer-web-mcp (product caller)
//
// MESITA-3971: Mesita as an MCP server for Claude and ChatGPT. The guest
// pastes their private connector URL (Me › Integrations › MCP) into the
// assistant; the token in the path is the only key and opens that guest's
// reservations and the public catalog, read-only.
//
//   POST /consumer-web-mcp/<token>   JSON-RPC (initialize, tools/*, ping)
//   GET  /consumer-web-mcp/<token>   405: no server-to-client stream
//
// Public (verify_jwt = false): the assistants' servers carry no Supabase
// session. An unknown token answers 404, not 401, so no client goes looking
// for an OAuth server that isn't there.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { anonClient } from "../_shared/auth.ts";
import { isLinkToken } from "../_shared/link-token.ts";
import { handleMcpBody } from "../_shared/mcp-rpc.ts";
import { MCP_TOOLS, mcpToolRunner } from "../_shared/mcp-tools.ts";

const FN = "consumer-web-mcp";

/** The token after the function's name in the path. */
export function tokenFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const at = parts.indexOf(FN);
  const token = at >= 0 ? parts[at + 1] : undefined;
  return isLinkToken(token) ? token : null;
}

function rpcError(status: number, message: string): Response {
  return Response.json({
    jsonrpc: "2.0",
    id: null,
    error: { code: -32001, message },
  }, { status });
}

serveJson("consumer-web-mcp", async (req) => {
  if (req.method === "GET" || req.method === "DELETE") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  const ctx = openRequest(req, ["POST"]);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;

  const token = tokenFromPath(new URL(req.url).pathname);
  if (!token) {
    return rpcError(
      404,
      "Unknown Mesita connector link. Copy it again from Me › Integrations › MCP.",
    );
  }
  const { data: link, error } = await admin
    .from("consumer_mcp_links")
    .select("consumer_id, last_used_at")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    console.error(`[${FN}] link:`, error.message);
    return rpcError(500, "Mesita is unavailable. Try again.");
  }
  if (!link) {
    return rpcError(
      404,
      "This Mesita connector link was replaced. Copy the new one from Me › Integrations › MCP.",
    );
  }

  // Last used, at most once an hour: the page can say "Connected".
  const last = link.last_used_at ? Date.parse(link.last_used_at) : 0;
  if (Date.now() - last > 3600_000) {
    const { error: touchError } = await admin
      .from("consumer_mcp_links")
      .update({ last_used_at: new Date().toISOString() })
      .eq("consumer_id", link.consumer_id);
    if (touchError) console.error(`[${FN}] touch:`, touchError.message);
  }

  return await handleMcpBody(
    await req.text(),
    MCP_TOOLS,
    mcpToolRunner(anonClient(env), admin, link.consumer_id),
  );
});
