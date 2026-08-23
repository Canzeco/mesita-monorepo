// Tickets v2 self-check-in — the shared core of the public check surface
// (MESITA-806). One home for: the possession token, the code→ticket lookup,
// the PUBLIC PAYLOAD ALLOWLIST, and the audit/rate-limit plumbing.
//
// Security model, stated plainly: the check-web-* EFs are verify_jwt=false.
// The 128-bit check_code is the entire authentication — whoever holds the
// URL can view the ticket, enter the bill, and mark it paid. That includes
// the guest themselves (the QR is static; a
// forwarded screenshot is indistinguishable from a live scan). This is
// ACCEPTED by design: Mesita never moves money — the staff physically
// applies the discount off the same page — so self-service is a data-quality
// nuisance, not a theft vector. The mitigations are visibility, not
// prevention: first_scanned_at surfaced on the page, ticket_check_events
// with self_view + ip_hash, and the guest's name on the card so staff can
// match a face.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { amountDueCents } from "./business-ticket-billing.ts";

// Canonical public URL of a check — the QR encodes exactly this.
export const CHECK_URL_BASE = "https://check.mesita.ai/";

export function checkUrlFor(code: string): string {
  return `${CHECK_URL_BASE}${code}`;
}

// 16 random bytes → 22-char base64url. Same shape as _shared/tokens.ts
// newInviteToken, sized to 128 bits: enumeration is dead by entropy alone
// (the rate limiter below is defense-in-depth, not the primary control).
export function newCheckCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Plausible check codes only — anything else 404s without touching the DB.
const CHECK_CODE_RE = /^[A-Za-z0-9_-]{20,24}$/;

export function isPlausibleCheckCode(code: string): boolean {
  return CHECK_CODE_RE.test(code);
}

// ── Lookup ──────────────────────────────────────────────────────────────

export const CHECK_TICKET_COLUMNS =
  "id, project_id, consumer_id, status, check_code, first_scanned_at, " +
  "story_status, story_screenshot_url, review_status, review_screenshot_url, " +
  "bill_subtotal_cents, tip_cents, tip_pct, total_cents, discount_percent, discount_cents, " +
  "bill_source, currency, created_at, revealed_at, cancelled_at, " +
  "updated_at, approved_at, fix_requested, fix_note, paid_method, validated_at";

export type CheckTicketRow = {
  id: string;
  project_id: string;
  consumer_id: string;
  status: string;
  check_code: string;
  first_scanned_at: string | null;
  story_status: string | null;
  story_screenshot_url: string | null;
  review_status: string | null;
  review_screenshot_url: string | null;
  bill_subtotal_cents: number | null;
  tip_cents: number | null;
  tip_pct: number | null;
  total_cents: number | null;
  updated_at: string;
  approved_at: string | null;
  fix_requested: string | null;
  fix_note: string | null;
  paid_method: string | null;
  validated_at: string | null;
  discount_percent: number | null;
  discount_cents: number | null;
  bill_source: string | null;
  currency: string | null;
  created_at: string;
  revealed_at: string | null;
  cancelled_at: string | null;
};

export async function loadTicketByCheckCode(
  admin: SupabaseClient,
  code: string,
): Promise<CheckTicketRow | null> {
  if (!isPlausibleCheckCode(code)) return null;
  const { data } = await admin
    .from("visit_tickets")
    .select(CHECK_TICKET_COLUMNS)
    .eq("check_code", code)
    .maybeSingle();
  return (data as CheckTicketRow | null) ?? null;
}

// ── The public payload allowlist ────────────────────────────────────────
//
// EVERYTHING the unauthenticated page may see is shaped here and nowhere
// else. Never add: class_key, segment/rung names, the rate breakdown or
// strategy, consumers.code, consumer/ticket UUIDs, phone, follower count.
// discount_percent is the blended final integer — the same privacy invariant
// resolveTicketRate already enforces. Every verified value collapses to
// "approved" so the verification channel itself doesn't leak.
//
// v3 (MESITA-849): these states are DISPLAY ONLY. The guest completes their
// tasks before the scan, so the page reports what they did — it never asks
// staff to rule on it. "pending"/"submitted"/"rejected" survive purely to
// render pre-v3 tickets.

function collapseActionState(status: string | null): {
  required: boolean;
  state: "none" | "pending" | "submitted" | "approved" | "rejected";
} {
  switch (status) {
    case "pending":
      return { required: true, state: "pending" };
    case "submitted":
      return { required: true, state: "submitted" };
    case "self_verified":
    case "ai_verified":
    case "staff_verified":
    case "waiter_verified": // legacy value kept through the r1 enum rename
      return { required: true, state: "approved" };
    case "ai_rejected":
    case "staff_rejected":
      return { required: true, state: "rejected" };
    default:
      return { required: false, state: "none" };
  }
}

export function shapeCheckPayload(args: {
  ticket: CheckTicketRow;
  placeName: string;
  placeSlug: string | null;
  guestDisplayName: string;
  guestInstagramHandle: string | null;
  capMxn: number | null;
  /** Place has a staff PIN set — the page prompts before write actions.
   *  Boolean ONLY; the PIN value never enters the public payload. */
  pinRequired: boolean;
  /** v3b (MESITA-850): the bill is optional, so an UNBILLED ticket must
   *  still state the commitment — "N% off, up to MX$<cap>" — for the place
   *  to apply at its own POS. Live best-of blended percent; same privacy
   *  shape as discount_percent. Omit/null → no offer block. */
  offerRatePercent?: number | null;
  /** MESITA-898: the place requires a bill on record before the close —
   *  the page shows the subtotal step as mandatory and holds the close
   *  button until check-web-submit-bill ran. Default false = v3b optional. */
  billRequired?: boolean;
}): Record<string, unknown> {
  const { ticket } = args;
  const story = collapseActionState(ticket.story_status);
  const review = collapseActionState(ticket.review_status);
  const billed = (ticket.total_cents ?? 0) > 0;
  return {
    status: ticket.status,
    created_at: ticket.created_at,
    first_scanned_at: ticket.first_scanned_at,
    // v4 (MESITA-1090): the CAS token — staff mutations echo this back as
    // expectedUpdatedAt so an approve can never land on numbers the staff
    // screen never rendered.
    updated_at: ticket.updated_at,
    approved_at: ticket.approved_at,
    fix_requested: ticket.fix_requested,
    fix_note: ticket.fix_note,
    paid_method: ticket.paid_method,
    validated_at: ticket.validated_at,
    currency: ticket.currency ?? "MXN",
    place: { name: args.placeName, slug: args.placeSlug },
    guest: {
      display_name: args.guestDisplayName,
      instagram_handle: args.guestInstagramHandle,
    },
    bill: billed
      ? {
        bill_subtotal_cents: ticket.bill_subtotal_cents,
        tip_cents: ticket.tip_cents,
        tip_pct: ticket.tip_pct,
        discount_percent: ticket.discount_percent,
        discount_cents: ticket.discount_cents,
        // ONE amount-due formula for every surface (C4-6, MESITA-1087):
        // subtotal − discount + tip, from business-ticket-billing. Three
        // hand-rolled copies used to agree only because tip was always 0.
        amount_due_cents: amountDueCents({
          checkSubtotalCents: ticket.bill_subtotal_cents ?? 0,
          discountCents: ticket.discount_cents ?? 0,
          tipCents: ticket.tip_cents ?? 0,
        }),
        reward_cap_mxn: args.capMxn,
      }
      : null,
    // The cap-as-instruction block (MESITA-850): present only while the
    // ticket has no bill and a live rate was resolved.
    offer: !billed && args.offerRatePercent != null
      ? {
        discount_percent: args.offerRatePercent,
        reward_cap_mxn: args.capMxn,
      }
      : null,
    story: {
      required: story.required,
      state: story.state,
      // Pre-v3 leftovers only: a story still awaiting a verdict. Nothing on
      // the page acts on it any more, but hiding a screenshot staff were
      // already shown would be a regression for tickets mid-flight.
      screenshot_url: story.state === "submitted" || story.state === "rejected"
        ? ticket.story_screenshot_url
        : null,
    },
    review: { required: review.required, state: review.state },
    // v2 tickets are always guest-generated; scanned_before lets the page
    // say "first opened 47 min ago" — the red flag staff can actually see.
    self_opened: true,
    // Staff PIN gate (MESITA-823) — flag only, never the value.
    pin_required: args.pinRequired,
    // Bill-required gate (MESITA-898) — the close refuses until billed.
    bill_required: args.billRequired ?? false,
  };
}

// ── Audit + rate limiting ───────────────────────────────────────────────

// The story_*/review_* verdict events retired with the staff verdict itself
// (MESITA-849) — nothing writes them any more. Stored rows keep their values;
// this union only constrains new inserts.
//
// `ticket_check_events.event` is a plain text column, not a Postgres enum, so
// a value missing here still writes fine at runtime — which is exactly how the
// four v4 events below drifted out of the union unnoticed (MESITA-1140). Keep
// this list equal to the set of literals passed to logCheckEvent.
export type CheckEvent =
  | "scanned"
  | "bill_submitted"
  | "marked_paid"
  | "pin_rejected"
  // The v4 check journey: scan · approve / one-fix · validate.
  | "scan_opened"
  | "approved"
  | "fix_requested"
  | "validated";

// sha256(ip | yyyy-mm-dd | server salt) — the raw IP never lands in the DB,
// and the daily rotation means hashes can't be joined across days.
export async function hashRequestIp(
  req: Request,
  salt: string,
): Promise<string | null> {
  const ip = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")[0]
    .trim();
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${ip}|${day}|${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function logCheckEvent(
  admin: SupabaseClient,
  args: {
    ticketId: string;
    event: CheckEvent;
    selfView: boolean;
    ipHash: string | null;
    userAgent: string | null;
  },
): Promise<void> {
  // Fire-and-forget: the audit trail must never fail a guest-facing action.
  await admin.from("ticket_check_events").insert({
    ticket_id: args.ticketId,
    event: args.event,
    self_view: args.selfView,
    ip_hash: args.ipHash,
    user_agent: args.userAgent?.slice(0, 300) ?? null,
  });
}

// Sliding-window limiter over the audit table itself (no new infra). Only
// counts SUCCESSFUL operations — failed lookups never reach the DB, where
// the 128-bit entropy is the control. Returns true when the caller should
// 429.
export async function isRateLimited(
  admin: SupabaseClient,
  ipHash: string | null,
  opts: { maxPerMinute: number },
): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("ticket_check_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return (count ?? 0) >= opts.maxPerMinute;
}

// Uniform miss: unknown, implausible, cancelled-and-purged — all identical,
// so the endpoint is not an existence oracle.
export function checkNotFound(json: (b: unknown, s?: number) => Response): Response {
  return json({ ok: false, error: "Check not found" }, 404);
}

// ── Per-place check settings (MESITA-823 · MESITA-898) ─────────────────
//
// The two staff-side knobs living on projects, EF-only (never in
// profiles): check_pin — optional 6-digit PIN gating WRITE actions
// (NULL = off; NOT a waiter identity, MESITA-833 stands) — and
// check_require_bill — when true, mark-paid refuses to close an unbilled
// ticket. get-ticket never gates; it exposes the booleans `pin_required`
// and `bill_required` so the page can prompt.

export type CheckSettings = {
  pin: string | null;
  requireBill: boolean;
  /** MESITA-1120: the read itself failed, so we do NOT know whether this
   *  place has a PIN. `pin: null` alone cannot carry that — an unconfigured
   *  PIN and an errored read produce the identical row. Gates must DENY on
   *  this; only the display path may degrade. */
  loadFailed: boolean;
};

export async function loadCheckSettings(
  admin: SupabaseClient,
  projectId: string,
): Promise<CheckSettings> {
  const { data, error } = await admin
    .from("projects")
    .select("check_pin, check_require_bill")
    .eq("id", projectId)
    .maybeSingle();
  // A transient DB error, an exhausted pool, a timeout, a renamed column or
  // an RLS change all return data = null. Reporting that as "no PIN
  // configured" is what ungated all six write EFs (MESITA-1120).
  if (error) {
    console.error("loadCheckSettings failed", {
      projectId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return { pin: null, requireBill: false, loadFailed: true };
  }
  const row = data as
    | { check_pin: string | null; check_require_bill: boolean | null }
    | null;
  const pin = row?.check_pin ?? null;
  return {
    pin: pin && /^[0-9]{6}$/.test(pin) ? pin : null,
    requireBill: row?.check_require_bill === true,
    loadFailed: false,
  };
}

// Verify the caller's PIN against the place's. Returns the 401 to send on
// failure; distinguishes "you didn't send one" (pin_required — the client
// shows the input) from "wrong" (pin_invalid — audit-logged, which also
// feeds the sliding-window rate limiter, so guessing throttles itself:
// 30 attempts/min against a 10^6 space).
export async function requireCheckPin(args: {
  admin: SupabaseClient;
  projectId: string;
  ticketId: string;
  pin: unknown;
  ipHash: string | null;
  userAgent: string | null;
  json: (b: unknown, s?: number) => Response;
  /** Pass when the caller already loaded the place's check settings —
   *  skips the redundant projects read. */
  settings?: CheckSettings;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const settings = args.settings ??
    await loadCheckSettings(args.admin, args.projectId);

  // MESITA-1120: "we could not determine whether a PIN is configured" is not
  // "no PIN configured". Deny, loudly and retryably — never fall through to
  // the ok:true below, which is the whole gate on six verify_jwt=false EFs.
  if (settings.loadFailed) {
    return {
      ok: false,
      response: args.json(
        {
          ok: false,
          code: "pin_unavailable",
          error: "Could not verify the staff PIN. Try again in a moment.",
        },
        503,
      ),
    };
  }

  const required = settings.pin;
  if (!required) return { ok: true };

  const supplied = typeof args.pin === "string" ? args.pin.trim() : "";
  if (supplied === required) return { ok: true };

  if (supplied) {
    // Only real wrong attempts land in the audit trail — the bare first
    // request from a page that didn't know a PIN was needed is normal flow.
    await logCheckEvent(args.admin, {
      ticketId: args.ticketId,
      event: "pin_rejected",
      selfView: false,
      ipHash: args.ipHash,
      userAgent: args.userAgent,
    });
  }
  return {
    ok: false,
    response: args.json(
      {
        ok: false,
        code: supplied ? "pin_invalid" : "pin_required",
        error: supplied
          ? "Incorrect staff PIN."
          : "This place requires a staff PIN for check actions.",
      },
      401,
    ),
  };
}
