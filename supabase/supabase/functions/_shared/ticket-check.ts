// Tickets v2 self-check-in — the shared core of the public check surface
// (MESITA-806). One home for: the possession token, the code→ticket lookup,
// the PUBLIC PAYLOAD ALLOWLIST, and the audit/rate-limit plumbing.
//
// Security model, stated plainly: the check-web-* EFs are verify_jwt=false.
// The 128-bit check_code is the entire authentication — whoever holds the
// URL can view the ticket, enter the bill, approve a submitted story/review,
// and mark it paid. That includes the guest themselves (the QR is static; a
// forwarded screenshot is indistinguishable from a live scan). This is
// ACCEPTED by design: Mesita never moves money — the waiter physically
// applies the discount off the same page — so self-service is a data-quality
// nuisance, not a theft vector. The mitigations are visibility, not
// prevention: first_scanned_at surfaced on the page, ticket_check_events
// with self_view + ip_hash, and the guest's name on the card so staff can
// match a face.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Canonical public URL of a check — the QR encodes exactly this.
export const CHECK_URL_BASE = "https://mesita.ai/check/";

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
  "id, project_id, consumer_id, kind, status, check_code, first_scanned_at, " +
  "story_status, story_screenshot_url, review_status, review_screenshot_url, " +
  "check_subtotal_cents, tip_cents, total_cents, discount_percent, discount_cents, " +
  "currency, created_at, revealed_at, cancelled_at";

export type CheckTicketRow = {
  id: string;
  project_id: string;
  consumer_id: string;
  kind: string;
  status: string;
  check_code: string;
  first_scanned_at: string | null;
  story_status: string | null;
  story_screenshot_url: string | null;
  review_status: string | null;
  review_screenshot_url: string | null;
  check_subtotal_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
  discount_percent: number | null;
  discount_cents: number | null;
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
    .from("tickets")
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
// resolveTicketRate already enforces. ai_verified/staff_verified collapse to
// "approved" so even the verification channel doesn't leak.

function collapseActionState(status: string | null): {
  required: boolean;
  state: "none" | "pending" | "submitted" | "approved" | "rejected";
} {
  switch (status) {
    case "pending":
      return { required: true, state: "pending" };
    case "submitted":
      return { required: true, state: "submitted" };
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
}): Record<string, unknown> {
  const { ticket } = args;
  const story = collapseActionState(ticket.story_status);
  const review = collapseActionState(ticket.review_status);
  const billed = (ticket.total_cents ?? 0) > 0;
  return {
    status: ticket.status,
    created_at: ticket.created_at,
    first_scanned_at: ticket.first_scanned_at,
    currency: ticket.currency ?? "MXN",
    place: { name: args.placeName, slug: args.placeSlug },
    guest: {
      display_name: args.guestDisplayName,
      instagram_handle: args.guestInstagramHandle,
    },
    bill: billed
      ? {
        check_subtotal_cents: ticket.check_subtotal_cents,
        discount_percent: ticket.discount_percent,
        discount_cents: ticket.discount_cents,
        amount_due_cents: ticket.total_cents,
        reward_cap_mxn: args.capMxn,
      }
      : null,
    story: {
      required: story.required,
      state: story.state,
      // The screenshot is only staff-relevant while a decision is pending.
      screenshot_url: story.state === "submitted" || story.state === "rejected"
        ? ticket.story_screenshot_url
        : null,
    },
    review: { required: review.required, state: review.state },
    // v2 tickets are always guest-generated; scanned_before lets the page
    // say "first opened 47 min ago" — the red flag staff can actually see.
    self_opened: true,
  };
}

// ── Audit + rate limiting ───────────────────────────────────────────────

export type CheckEvent =
  | "scanned"
  | "bill_submitted"
  | "story_approved"
  | "story_rejected"
  | "review_approved"
  | "review_rejected"
  | "marked_paid";

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
