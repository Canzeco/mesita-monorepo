// Supabase Edge Function — consumer-mcp
//
// Streamable HTTP MCP endpoint for the Consumer MCP. Authenticated with a
// personal access token (mesita_mcp_…), NOT a Supabase JWT — so Claude /
// ChatGPT / Cursor can control the signed-in consumer's Mesita profile.
//
// Protocol: JSON-RPC 2.0 over POST (initialize, tools/list, tools/call,
// notifications/initialized). Stateless sessions (Mcp-Session-Id echoed
// for clients that require it; no server-side session store).
//
// Tools wrap the same DB work as consumer-web-* EFs (service role, scoped
// to the token's consumer_id) — no EF→EF hop.
//
// verify_jwt = false in config.toml (custom bearer).
// Deploy: supabase functions deploy consumer-mcp

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { resolveMcpBearer } from "../_shared/mcp-tokens.ts";
import { PLACE_PUBLIC_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeys } from "../_shared/place-family-keys.ts";
import { getTierConfig, isPremiumPlan, perkClassKey } from "../_shared/membership.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import { suggestPlaces } from "../_shared/suggest-places.ts";
import { CORS } from "../_shared/cors.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type JsonRpcId,
  PROTOCOL_VERSION,
  rpcError,
  rpcResult,
  toolError,
  toolText,
} from "./rpc.ts";
import { clamp, UUID_RE } from "./tool-args.ts";
import { TOOLS } from "./tools.ts";
import { getProfileTool } from "./profile-tool.ts";
import { parseReservationArgs } from "./reservation-args.ts";

type JsonRpcReq = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

async function runTool(
  name: string,
  args: Record<string, unknown>,
  admin: SupabaseClient,
  consumerId: string,
  env: { url: string; anonKey: string; serviceKey: string },
): Promise<ReturnType<typeof toolText>> {
  switch (name) {
    case "get_profile": {
      return getProfileTool(admin, consumerId);
    }

    case "list_saved_places": {
      const limit = clamp(args.limit, 1, 100, 50);
      const { data, error } = await admin
        // favorites.project_id → projects → places is two hops; a direct
        // places embed 500s. Stitch instead (_shared/reservation-places.ts).
        .from("favorites")
        .select("id, created_at, place_id")
        .eq("consumer_id", consumerId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return toolError(error.message);
      return toolText({ ok: true, saved_places: await attachPlaces(admin, data ?? []) });
    }

    case "save_place": {
      const placeId = String(args.place_id ?? "");
      const saved = args.saved === true;
      if (!UUID_RE.test(placeId)) return toolError("place_id must be a UUID");
      if (typeof args.saved !== "boolean") {
        return toolError("saved (boolean) required");
      }

      if (saved) {
        const { data: row, error } = await admin
          .from("favorites")
          .upsert(
            { consumer_id: consumerId, place_id: placeId },
            { onConflict: "consumer_id,place_id" },
          )
          .select("id, place_id, created_at")
          .single();
        if (error) return toolError(error.message);
        // A favorite is a pure bookmark — it issues nothing.
        return toolText({ ok: true, saved_place: row });
      }

      const { error } = await admin
        .from("favorites")
        .delete()
        .eq("consumer_id", consumerId)
        .eq("place_id", placeId);
      if (error) return toolError(error.message);
      return toolText({ ok: true, saved: false });
    }

    case "suggest_places": {
      const query = String(args.query ?? "").trim();
      if (!query) return toolError("query required");
      // Google Autocomplete requires a session token; mint one per tool call.
      const sessionToken = crypto.randomUUID();
      const res = await suggestPlaces(env, "consumer-mcp", {
        input: query,
        sessionToken,
        callerUserId: consumerId,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        return toolError(
          (body as { error?: string } | null)?.error ??
            `suggest failed (${res.status})`,
        );
      }
      return toolText(body);
    }

    case "get_place": {
      const idOrSlug = String(args.id_or_slug ?? "").trim();
      if (!idOrSlug) return toolError("id_or_slug required");
      const column = UUID_RE.test(idOrSlug) ? "id" : "slug";
      const { data, error } = await admin
        .from("profiles")
        .select(PLACE_PUBLIC_COLUMNS)
        .eq(column, idOrSlug)
        .maybeSingle();
      if (error) return toolError(error.message);
      if (!data) return toolError("Place not found");
      return toolText({
        ok: true,
        place: withFamilyKeys(
          data as {
            name?: string | null;
            google_name?: string | null;
            category?: string | null;
          },
        ),
      });
    }

    case "list_reservations": {
      const limit = clamp(args.limit, 1, 100, 50);
      const scope = args.scope === "past" || args.scope === "all"
        ? args.scope
        : "upcoming";
      // NO place embed — reservations→places is a two-hop FK chain PostgREST
      // can't resolve; attachPlaces does the lookup (see the shared module).
      let q = admin
        .from("reservation_tickets")
        .select(
          "id, reserved_at, party_size, status, reference_code, notes, confirmed_at, completed_at, cancelled_at, created_at, place_id",
        )
        .eq("consumer_id", consumerId)
        // Operator test tickets (is_test) reference real consumers — hidden.
        .eq("is_test", false)
        .order("reserved_at", { ascending: scope === "past" ? false : true })
        .limit(limit);
      if (scope === "upcoming") q = q.in("status", ["pending", "confirmed"]);
      else if (scope === "past") {
        // Engine outcomes included, else those tickets are invisible in both scopes.
        q = q.in("status", ["declined", "no_show", "cancelled", "unreachable", "unresolved"]);
      }
      const { data, error } = await q;
      if (error) return toolError(error.message);
      return toolText({ ok: true, reservations: await attachPlaces(admin, data ?? []) });
    }

    case "create_reservation": {
      const parsed = parseReservationArgs(args);
      if (!parsed.ok) return toolError(parsed.error);
      const { placeId, reservedAt, partySize, notes, guestNotify } = parsed;

      const { data: consumerRow } = await admin
        .from("consumers")
        .select("class_key, plan")
        .eq("id", consumerId)
        .maybeSingle();
      const classKey = perkClassKey(consumerRow?.class_key, consumerRow?.plan);
      let tier = null;
      try {
        tier = await getTierConfig(admin, classKey);
      } catch {
        tier = null;
      }
      const monthlyLimit = tier?.monthly_reservation_limit ?? null;
      if (monthlyLimit != null) {
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const { count, error: countErr } = await admin
          .from("reservation_tickets")
          .select("id", { count: "exact", head: true })
          .eq("consumer_id", consumerId)
          .eq("is_test", false)
          .gte("created_at", monthStart.toISOString())
          .neq("status", "cancelled");
        if (countErr) return toolError(countErr.message);
        if ((count ?? 0) >= monthlyLimit) {
          return toolError(
            "Monthly reservation limit reached. Upgrade to Mesita Premium for unlimited reservations.",
          );
        }
      }

      // Insert with the ticket's 8-digit reference code — fresh code per try;
      // a unique-index collision just redraws.
      let reservation: Record<string, unknown> | null = null;
      let insertError: { message: string } | null = null;
      for (let i = 0; i < 3 && !reservation; i++) {
        // No places embed — two-hop FK (_shared/reservation-places.ts).
        const ins = await writeReservation(admin, {
          mode: "insert",
          patch: {
            consumer_id: consumerId,
            project_id: placeId,
            reference_code: generateReservationCode(),
            reserved_at: reservedAt.toISOString(),
            party_size: partySize,
            notes,
            consumer_notify: guestNotify,
            status: "pending",
          },
          select:
            "id, reference_code, reserved_at, party_size, status, notes, consumer_notify, created_at, project_id",
        });
        if (ins.ok) {
          reservation = ins.row as Record<string, unknown>;
          insertError = null;
        } else {
          insertError = { message: ins.error };
          if (!isUniqueViolation({ code: ins.code })) break;
        }
      }
      if (!reservation) return toolError(insertError?.message ?? "insert failed");
      const [reservationWithPlace] = await attachPlaces(admin, [
        reservation as { project_id?: string | null },
      ]);
      return toolText({
        ok: true,
        reservation: reservationWithPlace ?? reservation,
      });
    }

    default:
      return toolError(`Unknown tool: ${name}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  // GET → tiny discovery doc (not part of MCP handshake; helps humans).
  if (req.method === "GET") {
    return json({
      ok: true,
      name: "mesita-consumer",
      title: "Mesita Consumer MCP",
      protocolVersion: PROTOCOL_VERSION,
      transport: "streamable-http",
      auth: "Authorization: Bearer mesita_mcp_… (mint from Me → AI in the app)",
      tools: TOOLS.map((t) => t.name),
    });
  }

  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);

  const auth = await resolveMcpBearer(req, admin);
  if (!auth.ok) return auth.response;
  const consumerId = auth.token.consumer_id;

  // decision: Pato — Consumer MCP is Premium-only (MESITA-266).
  const { data: consumerRow } = await admin
    .from("consumers")
    .select("class_key, plan")
    .eq("id", consumerId)
    .maybeSingle();
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

  let body: JsonRpcReq;
  try {
    body = (await req.json()) as JsonRpcReq;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  const id = body.id ?? null;
  const method = body.method ?? "";

  // Notifications have no id and expect 202/empty — return 204.
  if (method.startsWith("notifications/")) {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (method === "initialize") {
    const sessionId = crypto.randomUUID();
    const res = rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: {
        name: "mesita-consumer",
        version: "0.1.0",
        title: "Mesita Consumer",
      },
      instructions:
        "You are connected to a Mesita consumer account. Use tools to look up the profile, find/save places, and book reservations. Prefer Mesita Partners (listing_type=partner) when recommending places with rewards — the discount is earned by showing up and lands on the visit ticket.",
    });
    res.headers.set("Mcp-Session-Id", sessionId);
    return res;
  }

  if (method === "ping") {
    return rpcResult(id, {});
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const params = body.params ?? {};
    const name = String(params.name ?? "");
    const args = params.arguments && typeof params.arguments === "object"
      ? (params.arguments as Record<string, unknown>)
      : {};
    if (!name) return rpcError(id, -32602, "tools/call requires params.name");
    try {
      const result = await runTool(name, args, admin, consumerId, envRes.env);
      return rpcResult(id, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return rpcResult(id, toolError(msg));
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
});
