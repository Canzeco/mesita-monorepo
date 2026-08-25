// Supabase Edge Function — business-web-list-reservations
//
// Authenticated. Returns Mesita Reservationist bookings for a place the
// caller is a member of — plus the two AI dial lines (a3 guests / a4 places).
// Powers the business Reservations tab (MESITA-894).
//
// Privacy: never returns consumer class / entry door (blended-rate). Guest
// display is name-or-handle only.
//
// NO financial fields — reservations never carry money.
//
// Deploy: supabase functions deploy business-web-list-reservations

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import {
  consumerFromNumber,
  reservationFromNumber,
} from "../_shared/elevenlabs.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Privacy-safe select — no class_key / class_origin.
const SELECT =
  "id, reserved_at, party_size, status, is_test, " +
  "consumer:consumers(full_name, first_name, instagram_handle)";

type Scope = "upcoming" | "past" | "all";
type Body = { placeId?: string; projectId?: string; limit?: number; scope?: Scope };

type GuestShape = {
  full_name: string | null;
  first_name: string | null;
  instagram_handle: string | null;
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

function guestName(c: GuestShape | null): string {
  if (!c) return "Guest";
  const full = c.full_name?.trim();
  if (full) return full;
  const first = c.first_name?.trim();
  if (first) return first;
  const ig = c.instagram_handle?.trim();
  if (ig) return `@${ig.replace(/^@/, "")}`;
  return "Guest";
}

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
  const body = bodyRes.body;
  const projectId = readPlaceIdAlias(body);
  if (!projectId) return json({ ok: false, error: "projectId is required" }, 400);
  const limit = clampIntRange(Number(body.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT);
  // Tab default = all (ops view). "upcoming" / "past" remain for filters.
  const scope: Scope =
    body.scope === "upcoming" || body.scope === "past" || body.scope === "all"
      ? body.scope
      : "all";

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  let q = admin
    .from("reservation_tickets")
    .select(SELECT, { count: "exact" })
    .eq("place_id", projectId)
    .eq("is_test", false)
    .order("reserved_at", { ascending: false })
    .limit(limit);

  if (scope === "upcoming") {
    q = q.in("status", ["pending", "confirmed"]);
  } else if (scope === "past") {
    q = q.in("status", ["declined", "no_show", "cancelled", "unreachable", "unresolved"]);
  }

  const { data, error, count } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    id: string;
    reserved_at: string | null;
    party_size: number | null;
    status: string | null;
    is_test: boolean | null;
    consumer: GuestShape | GuestShape[] | null;
  };

  const reservations = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    reservedAt: r.reserved_at,
    partySize: r.party_size,
    status: r.status,
    isTest: r.is_test === true,
    guest: guestName(one(r.consumer)),
  }));

  return json({
    ok: true,
    reservations,
    reservationTotal: count ?? reservations.length,
    lines: {
      guest: consumerFromNumber(),
      place: reservationFromNumber(),
    },
  });
});
