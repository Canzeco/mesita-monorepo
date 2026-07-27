// Supabase Edge Function — eleven-agent-get-reservation (vendor caller)
//
// Naming: caller-verb-words. Caller = eleven-agent — the ElevenLabs
// Reservationist calling home MID-CONVERSATION as a server tool (webhook on the
// agent), the same vendor-caller family as stripe-webhook-* / twilio-*. This is
// how "connect ElevenLabs to Supabase" works in Mesita: the agent never touches
// the DB — it calls an EF, like every other client.
//
// Looks up a reservation ticket in REAL TIME so the agent can verify what a
// caller says on the phone. Two lookup keys, either works:
//   { reference_code }              — the ticket's 8-digit code (exact)
//   { first_name?, last_name? }     — the guest's name (fuzzy, at least one)
// Searches BOTH public.reservations (production) and
// public.playground_reservations (sandbox — so admin test calls resolve too),
// newest first, 5 max, each labeled with its source.
//
// Auth (two locks):
//   1. Gateway verify_jwt — the tool sends `Authorization: Bearer <anon key>`
//      (the anon key is a valid project JWT; it grants NOTHING here by itself).
//   2. `x-agent-secret` header must match app_settings.agents_config.toolSecret
//      (timing-safe). Stored in the DB, not EF env, so it rotates with SQL.
//
// Deploy: supabase functions deploy eleven-agent-get-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts";

type Body = {
  reference_code?: unknown;
  first_name?: unknown;
  last_name?: unknown;
};

type AgentTicket = {
  source: "production" | "playground";
  reference_code: string | null;
  guest_name: string;
  place_name: string;
  /** Venue-local es-MX date + time the agent can speak back. */
  date_es: string;
  time_es: string;
  reserved_at: string;
  party_size: number;
  status: string;
  notes: string | null;
};

function esDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
function esTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// PostgREST .or() expressions are comma/paren-delimited — strip those (and
// wildcards) from user-spoken terms so a weird transcription can't break the
// filter syntax.
function cleanTerm(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/[,()%*]/g, "").slice(0, 60) : "";
}

function nameMatches(haystack: string, terms: string[]): boolean {
  const h = haystack.toLowerCase();
  return terms.every((t) => h.includes(t.toLowerCase()));
}

type PlaygroundRow = {
  reference_code: string | null;
  consumer_name: string | null;
  place_name: string | null;
  reserved_at: string;
  party_size: number;
  status: string;
  notes: string | null;
};

async function searchPlayground(
  admin: SupabaseClient,
  code: string | null,
  terms: string[],
): Promise<AgentTicket[]> {
  let q = admin
    .from("playground_reservations")
    .select("reference_code, consumer_name, place_name, reserved_at, party_size, status, notes")
    .order("created_at", { ascending: false })
    .limit(10);
  if (code) q = q.eq("reference_code", code);
  else q = q.ilike("consumer_name", `%${terms[0]}%`);
  const { data } = await q;
  return ((data ?? []) as PlaygroundRow[])
    .filter((r) => code || nameMatches(r.consumer_name ?? "", terms))
    .map((r) => ({
      source: "playground" as const,
      reference_code: r.reference_code ?? null,
      guest_name: r.consumer_name ?? "",
      place_name: r.place_name ?? "",
      date_es: esDate(r.reserved_at),
      time_es: esTime(r.reserved_at),
      reserved_at: r.reserved_at,
      party_size: r.party_size,
      status: r.status,
      notes: r.notes ?? null,
    }));
}

async function searchProduction(
  admin: SupabaseClient,
  code: string | null,
  terms: string[],
): Promise<AgentTicket[]> {
  type Row = {
    reference_code: string | null;
    reserved_at: string;
    party_size: number;
    status: string;
    notes: string | null;
    project_id: string;
    consumer: {
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };
  let rows: Row[] = [];
  if (code) {
    const { data } = await admin
      .from("reservations")
      .select(
        "reference_code, reserved_at, party_size, status, notes, project_id, consumer:consumers(full_name, first_name, last_name)",
      )
      .eq("reference_code", code)
      .limit(5);
    rows = (data ?? []) as Row[];
  } else {
    // Names live on consumers — resolve matching guests first, then their
    // reservations (reservations.consumer_id has no name columns to filter on).
    const t0 = terms[0];
    const { data: guests } = await admin
      .from("consumers")
      .select("id, full_name, first_name, last_name")
      .or(`full_name.ilike.%${t0}%,first_name.ilike.%${t0}%,last_name.ilike.%${t0}%`)
      .limit(25);
    type GuestRow = {
      id: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    };
    const ids = ((guests ?? []) as GuestRow[])
      .filter((g) =>
        nameMatches(
          g.full_name?.trim() || `${g.first_name ?? ""} ${g.last_name ?? ""}`,
          terms,
        )
      )
      .map((g) => g.id);
    if (ids.length === 0) return [];
    const { data } = await admin
      .from("reservations")
      .select(
        "reference_code, reserved_at, party_size, status, notes, project_id, consumer:consumers(full_name, first_name, last_name)",
      )
      .in("consumer_id", ids)
      .order("created_at", { ascending: false })
      .limit(10);
    rows = (data ?? []) as Row[];
  }
  if (rows.length === 0) return [];

  // reservations.project_id has no PostgREST FK hint to places — batch the
  // place names separately (same workaround as supabase-edgefunc-reservation-call).
  const placeIds = [...new Set(rows.map((r) => r.project_id))];
  const { data: places } = await admin
    .from("places")
    .select("id, name")
    .in("id", placeIds);
  const placeName = new Map<string, string>(
    ((places ?? []) as { id: string; name: string | null }[]).map(
      (p) => [p.id, p.name ?? ""],
    ),
  );

  return rows.map((r) => {
    const c = r.consumer;
    const guest = c?.full_name?.trim() ||
      [c?.first_name, c?.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
    return {
      source: "production" as const,
      reference_code: r.reference_code ?? null,
      guest_name: guest || "(sin nombre)",
      place_name: placeName.get(r.project_id) ?? "",
      date_es: esDate(r.reserved_at),
      time_es: esTime(r.reserved_at),
      reserved_at: r.reserved_at,
      party_size: r.party_size,
      status: r.status,
      notes: r.notes ?? null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);

  // Lock 2: the shared tool secret, read live from app_settings.
  const sent = (req.headers.get("x-agent-secret") ?? "").trim();
  const { data: settings } = await admin
    .from("app_settings")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  const expected =
    ((settings?.agents_config as Record<string, unknown> | null)?.toolSecret as
      | string
      | undefined)?.trim() ?? "";
  if (!expected || !sent || !timingSafeEqual(sent, expected)) {
    return json({ ok: false, error: "agent tool secret rejected" }, 401);
  }

  const body = await readJsonOr<Body>(req, {});
  const codeDigits = typeof body.reference_code === "string"
    ? body.reference_code.replace(/\D/g, "")
    : "";
  const code = /^\d{8}$/.test(codeDigits) ? codeDigits : null;
  const terms = [cleanTerm(body.first_name), cleanTerm(body.last_name)].filter(Boolean);
  if (!code && terms.length === 0) {
    return json({
      ok: false,
      error: "Pass reference_code (8 digits) or first_name / last_name",
    }, 400);
  }

  const [playground, production] = await Promise.all([
    searchPlayground(admin, code, terms),
    searchProduction(admin, code, terms),
  ]);
  const tickets = [...production, ...playground]
    .sort((a, b) => (a.reserved_at < b.reserved_at ? 1 : -1))
    .slice(0, 5);

  return json({ ok: true, found: tickets.length, tickets });
});
