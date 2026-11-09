// The Stripe Connect receiver's rules (MESITA-3305, W2b). The Edge Function
// stripe-connect-receive-event is the thin door: it caps the body, checks
// the secret and the signature, parses, and hands the event here. This
// module decides what an event means and answers by failure class, so the
// fixtures in connect-events.test.ts run it with a fake database and a
// fake Stripe.
//
//   the signature     HMAC-SHA256 over `${t}.${raw}` with the endpoint
//                     secret, constant-time compare, 300-second tolerance
//   the replay guard  stripe_connect_events: inserted first with
//                     processed_at null, set when the work committed; a
//                     duplicate id is a replay (200, ignored); on a 5xx the
//                     row is deleted, so Stripe's retry runs the work
//   the answers       200 {ok, ignored: unknown_account | livemode | replay |
//                     unhandled}; 500 settle_failed {code, event_id, account,
//                     error} when an RPC or the database failed, so Stripe
//                     retries; a known account with a completed session that
//                     names no row of ours is a 500 too
//   disputes          only a lost charge.dispute.closed moves money: the
//                     charge's current amount_refunded is read from Stripe
//                     on the place's account and amount_refunded + the
//                     disputed amount goes to the same refund RPCs with
//                     p_reason dispute_lost (MESITA-3460); created, won and
//                     warning_closed log only
//   every log line    carries event.id and event.account

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import { snapshotFromStripe } from "./payments.ts";
import { releasePayment, settlePaidPayment } from "./settle-payment.ts";
import { timingSafeEqual } from "./timing-safe-equal.ts";

export const SIGNATURE_TOLERANCE_SEC = 300;
/** Stripe's events are a few KB; anything past this is not Stripe. */
export const MAX_BODY_BYTES = 64 * 1024;

export const CONNECT_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "account.updated",
] as const;

// ── The signature ──────────────────────────────────────────────────────────

/** `t=...,v1=...,v1=...` → the timestamp and every v1 signature. */
export function parseSignatureHeader(header: string | null): { t: number; v1: string[] } | null {
  if (!header) return null;
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "t" && /^\d+$/.test(v ?? "")) t = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v ?? "")) v1.push(v.toLowerCase());
  }
  return t === null || v1.length === 0 ? null : { t, v1 };
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Signs a raw body the way Stripe does; the tests build fixtures with it. */
export async function signPayload(secret: string, raw: string, tSec: number): Promise<string> {
  return `t=${tSec},v1=${await hmacHex(secret, `${tSec}.${raw}`)}`;
}

export type SignatureVerdict = { ok: true } | { ok: false; code: "bad_signature" | "stale_event" };

/** The gate: a malformed header or no matching v1 is bad_signature; a good
 *  signature older than the tolerance is stale_event (the body is Stripe's,
 *  but a replay this old is not trusted). */
export async function verifyStripeSignature(
  raw: string,
  header: string | null,
  secret: string,
  nowSec: number,
  toleranceSec: number = SIGNATURE_TOLERANCE_SEC,
): Promise<SignatureVerdict> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, code: "bad_signature" };
  const want = await hmacHex(secret, `${parsed.t}.${raw}`);
  if (!parsed.v1.some((got) => timingSafeEqual(got, want))) return { ok: false, code: "bad_signature" };
  if (Math.abs(nowSec - parsed.t) > toleranceSec) return { ok: false, code: "stale_event" };
  return { ok: true };
}

// ── The event ──────────────────────────────────────────────────────────────

export type ConnectEvent = {
  id: string;
  type: string;
  account?: string;
  livemode?: boolean;
  created?: number;
  data?: { object?: Record<string, unknown> };
};

export function isConnectEvent(v: unknown): v is ConnectEvent {
  const e = v as ConnectEvent | null;
  return !!e && typeof e === "object" && typeof e.id === "string" && e.id.startsWith("evt_") && typeof e.type === "string";
}

export type EventAnswer = { status: number; body: Record<string, unknown> };

export type EventDeps = {
  admin: SupabaseClient;
  /** Mesita's own key: a disputed charge is read with the place's account
   *  as Stripe-Account. */
  stripe: StripeCall;
  /** The key's universe; an event from the other one is acknowledged and ignored. */
  livemode: boolean;
};

function ignored(reason: string): EventAnswer {
  return { status: 200, body: { ok: true, ignored: reason } };
}

/** The whole decision for one verified event. */
export async function handleConnectEvent(deps: EventDeps, event: ConnectEvent): Promise<EventAnswer> {
  const tag = JSON.stringify({ event_id: event.id, account: event.account ?? null, type: event.type });
  if (typeof event.livemode === "boolean" && event.livemode !== deps.livemode) {
    console.log("[connect-events] livemode", tag);
    return ignored("livemode");
  }
  if (!(CONNECT_EVENT_TYPES as readonly string[]).includes(event.type)) {
    console.log("[connect-events] unhandled", tag);
    return ignored("unhandled");
  }
  if (!event.account) {
    console.log("[connect-events] no_account", tag);
    return ignored("unknown_account");
  }

  // The account must be one of ours.
  const { data: acct, error: acctErr } = await deps.admin
    .from("place_payment_accounts")
    .select("place_id, stripe_account_id, livemode, last_event_created")
    .eq("stripe_account_id", event.account)
    .maybeSingle();
  if (acctErr) {
    console.error("[connect-events] account_read", tag, acctErr.message);
    return failed(event, "account_read", acctErr.message);
  }
  if (!acct) {
    console.log("[connect-events] unknown_account", tag);
    return ignored("unknown_account");
  }

  // The replay guard: inserted before the work, deleted on a failure.
  const { error: insErr } = await deps.admin.from("stripe_connect_events").insert({
    id: event.id,
    account: event.account,
    type: event.type,
    created: event.created ?? Math.floor(Date.now() / 1000),
  });
  if (insErr) {
    if (insErr.code === "23505") {
      console.log("[connect-events] replay", tag);
      return ignored("replay");
    }
    console.error("[connect-events] event_insert", tag, insErr.message);
    return failed(event, "event_insert", insErr.message);
  }

  let answer: EventAnswer;
  try {
    answer = await dispatch(deps, event, acct as { place_id: string; last_event_created: number | null }, tag);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[connect-events] settle_failed", tag, message);
    await forget(deps.admin, event.id);
    return failed(event, "settle_failed", message);
  }
  if (answer.status >= 500) {
    await forget(deps.admin, event.id);
    return answer;
  }
  const { error: doneErr } = await deps.admin.from("stripe_connect_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  if (doneErr) console.error("[connect-events] processed_at", tag, doneErr.message);
  console.log("[connect-events] done", tag, JSON.stringify(answer.body));
  return answer;
}

async function forget(admin: SupabaseClient, eventId: string): Promise<void> {
  const { error } = await admin.from("stripe_connect_events").delete().eq("id", eventId);
  if (error) console.error("[connect-events] event_delete", eventId, error.message);
}

function failed(event: ConnectEvent, code: string, error: string): EventAnswer {
  return { status: 500, body: { ok: false, code: "settle_failed", reason: code, event_id: event.id, account: event.account ?? null, error } };
}

type LedgerRow = { kind: "purchase" | "payment"; id: string };

/** The ledger row a session names: metadata first, the stored session id
 *  second (a completed event can arrive before the id is stored). */
async function resolveSession(admin: SupabaseClient, session: Record<string, unknown>): Promise<LedgerRow | null> {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.payment_id === "string") return { kind: "payment", id: meta.payment_id };
  if (typeof meta.purchase_id === "string") return { kind: "purchase", id: meta.purchase_id };
  const sessionId = typeof session.id === "string" ? session.id : null;
  if (!sessionId) return null;
  const [p, y] = await Promise.all([
    admin.from("wallet_purchases").select("id").eq("stripe_checkout_session_id", sessionId).maybeSingle(),
    admin.from("wallet_payments").select("id").eq("stripe_checkout_session_id", sessionId).maybeSingle(),
  ]);
  if (p.error) throw new Error(`purchases_read: ${p.error.message}`);
  if (y.error) throw new Error(`payments_read: ${y.error.message}`);
  if (p.data) return { kind: "purchase", id: (p.data as { id: string }).id };
  if (y.data) return { kind: "payment", id: (y.data as { id: string }).id };
  return null;
}

/** The ledger row that owns a PaymentIntent: a purchase or a payment. */
async function rowByPaymentIntent(admin: SupabaseClient, pi: string): Promise<LedgerRow | null> {
  const [p, y] = await Promise.all([
    admin.from("wallet_purchases").select("id").eq("stripe_payment_intent_id", pi).maybeSingle(),
    admin.from("wallet_payments").select("id").eq("stripe_payment_intent_id", pi).maybeSingle(),
  ]);
  if (p.error) throw new Error(`purchases_read: ${p.error.message}`);
  if (y.error) throw new Error(`payments_read: ${y.error.message}`);
  if (p.data) return { kind: "purchase", id: (p.data as { id: string }).id };
  if (y.data) return { kind: "payment", id: (y.data as { id: string }).id };
  return null;
}

function idOfField(v: unknown): string | null {
  if (typeof v === "string") return v || null;
  if (v && typeof v === "object") return String((v as { id?: unknown }).id ?? "") || null;
  return null;
}

/** What the ledger must count as gone from a charge: Stripe's cumulative
 *  amount_refunded plus what lost disputes took, never past the charge. */
function goneCents(charge: Record<string, unknown>, refunded: number, lost: number): number {
  const total = refunded + lost;
  return typeof charge.amount === "number" ? Math.min(charge.amount, total) : total;
}

/** The refund RPC for a ledger row; an error or a refusal throws, so the
 *  event answers 500 and Stripe retries. The RPC is the last write. */
async function refundRow(
  admin: SupabaseClient,
  row: LedgerRow,
  amount: number,
  reason?: "dispute_lost",
): Promise<{ ok?: boolean; outcome?: string; code?: string; status?: string }> {
  const fn = row.kind === "purchase" ? "wallet_refund_purchase" : "wallet_refund_payment";
  const idArg = row.kind === "purchase" ? "p_purchase_id" : "p_payment_id";
  const args: Record<string, unknown> = { [idArg]: row.id, p_amount_refunded: amount };
  if (reason) args.p_reason = reason;
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  const res = data as { ok?: boolean; outcome?: string; code?: string; status?: string } | null;
  if (!res?.ok) throw new Error(`${fn}: ${res?.code ?? "unknown"}`);
  return res;
}

/** The disputed amount Stripe has closed as lost on a charge (a charge
 *  carries at most one dispute; the sum is defensive). A read failure
 *  throws: the event is retried. */
async function lostDisputeCents(stripe: StripeCall, account: string, chargeId: string): Promise<number> {
  const list = await stripe("GET", "disputes", { charge: chargeId, limit: 10 }, { stripeAccount: account });
  const data = Array.isArray(list.data) ? (list.data as Record<string, unknown>[]) : [];
  return data.reduce((sum, d) => sum + (d.status === "lost" && typeof d.amount === "number" ? d.amount : 0), 0);
}

function paymentIntentOf(obj: Record<string, unknown>): string | null {
  const pi = obj.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object") return String((pi as { id?: unknown }).id ?? "") || null;
  return null;
}

async function dispatch(
  deps: EventDeps,
  event: ConnectEvent,
  acct: { place_id: string; last_event_created: number | null },
  tag: string,
): Promise<EventAnswer> {
  const obj = event.data?.object ?? {};
  const { admin } = deps;

  switch (event.type) {
    case "checkout.session.completed": {
      const row = await resolveSession(admin, obj);
      if (!row) {
        // Ours by account, not by any row: Stripe retries while the id is
        // being stored; the cron is the floor under it.
        console.error("[connect-events] unresolved_session", tag, String(obj.id ?? ""));
        return failed(event, "unresolved_session", `no ledger row for ${String(obj.id ?? "")}`);
      }
      if (obj.payment_status !== "paid") {
        console.log("[connect-events] completed_unpaid", tag, row.id);
        return { status: 200, body: { ok: true, ignored: "unpaid", [`${row.kind}_id`]: row.id } };
      }
      const pi = paymentIntentOf(obj);
      if (row.kind === "payment") {
        const outcome = await settlePaidPayment(admin, row.id, pi);
        return { status: 200, body: { ok: true, payment_id: row.id, outcome } };
      }
      const { data, error } = await admin.rpc("wallet_credit_purchase", {
        p_purchase_id: row.id,
        p_payment_intent: pi,
        p_available_at: availableAtFromSession(obj, event.created),
      });
      if (error) throw new Error(`wallet_credit_purchase: ${error.message}`);
      const res = data as { ok?: boolean; outcome?: string; code?: string } | null;
      if (!res?.ok) throw new Error(`wallet_credit_purchase: ${res?.code ?? "unknown"}`);
      return { status: 200, body: { ok: true, purchase_id: row.id, outcome: res.outcome ?? "credited" } };
    }

    case "checkout.session.expired": {
      const row = await resolveSession(admin, obj);
      if (!row) {
        console.log("[connect-events] expired_unknown", tag, String(obj.id ?? ""));
        return { status: 200, body: { ok: true, ignored: "unknown_session" } };
      }
      if (row.kind === "payment") {
        await releasePayment(admin, row.id, "expired");
        return { status: 200, body: { ok: true, payment_id: row.id, outcome: "expired" } };
      }
      const { error } = await admin
        .from("wallet_purchases")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .in("status", ["opening", "open"]);
      if (error) throw new Error(`wallet_expire: ${error.message}`);
      return { status: 200, body: { ok: true, purchase_id: row.id, outcome: "expired" } };
    }

    case "charge.refunded": {
      const pi = paymentIntentOf(obj);
      const amountRefunded = typeof obj.amount_refunded === "number" ? obj.amount_refunded : null;
      if (!pi || amountRefunded === null) {
        console.log("[connect-events] refund_shape", tag);
        return { status: 200, body: { ok: true, ignored: "refund_shape" } };
      }
      const row = await rowByPaymentIntent(admin, pi);
      if (!row) {
        console.log("[connect-events] refund_unknown", tag, pi);
        return { status: 200, body: { ok: true, ignored: "unknown_charge" } };
      }
      // A refund after a lost dispute: Stripe's amount_refunded does not
      // count what the dispute took, so the ledger adds it back, or the
      // refund would read as already applied (MESITA-3460).
      const chargeId = idOfField(obj.id);
      const lost = obj.disputed === true && chargeId ? await lostDisputeCents(deps.stripe, event.account as string, chargeId) : 0;
      // The refund RPC also writes the refunded share of Mesita's fee
      // (MESITA-3461): a refunded part is never billed.
      const res = await refundRow(admin, row, goneCents(obj, amountRefunded, lost));
      return { status: 200, body: { ok: true, [`${row.kind}_id`]: row.id, outcome: res.outcome ?? "applied", status: res.status ?? null } };
    }

    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const disputeStatus = typeof obj.status === "string" ? obj.status : null;
      const chargeId = idOfField(obj.charge);
      if (event.type === "charge.dispute.created" || disputeStatus !== "lost") {
        // Opened, won or warning_closed: Stripe holds the money; nothing moves here.
        console.log("[connect-events] dispute_logged", tag, chargeId ?? "", disputeStatus ?? "");
        return { status: 200, body: { ok: true, outcome: "dispute_logged", dispute_status: disputeStatus } };
      }
      const disputed = typeof obj.amount === "number" ? obj.amount : null;
      if (!chargeId || disputed === null) {
        console.log("[connect-events] dispute_shape", tag);
        return { status: 200, body: { ok: true, ignored: "dispute_shape" } };
      }
      // Stripe does not order events: the charge's amount_refunded is read
      // now, never the stored baseline. A read failure throws (500, retried).
      const charge = await deps.stripe("GET", `charges/${encodeURIComponent(chargeId)}`, undefined, { stripeAccount: event.account as string });
      const pi = paymentIntentOf(obj) ?? paymentIntentOf(charge);
      const row = pi ? await rowByPaymentIntent(admin, pi) : null;
      if (!row) {
        console.log("[connect-events] dispute_unmatched", tag, chargeId, pi ?? "");
        return ignored("dispute_unmatched");
      }
      const refunded = typeof charge.amount_refunded === "number" ? charge.amount_refunded : 0;
      const res = await refundRow(admin, row, goneCents(charge, refunded, disputed), "dispute_lost");
      return { status: 200, body: { ok: true, [`${row.kind}_id`]: row.id, outcome: res.outcome ?? "applied", status: res.status ?? null, reason: "dispute_lost" } };
    }

    case "account.updated": {
      // Stripe does not order delivery: an older event than the last one
      // applied is acknowledged and ignored.
      const created = event.created ?? 0;
      if (acct.last_event_created !== null && created <= acct.last_event_created) {
        console.log("[connect-events] account_stale", tag);
        return { status: 200, body: { ok: true, ignored: "stale_account_event" } };
      }
      // livemode is the key's universe, never the event's: the row keeps it.
      const { livemode: _mode, ...snapshot } = snapshotFromStripe(obj, deps.livemode);
      const { error } = await admin
        .from("place_payment_accounts")
        .update({ ...snapshot, last_event_created: created, updated_at: new Date().toISOString() })
        .eq("stripe_account_id", event.account as string);
      if (error) throw new Error(`account_update: ${error.message}`);
      return { status: 200, body: { ok: true, place_id: acct.place_id, outcome: "account_updated" } };
    }
  }
  return ignored("unhandled");
}

/** A voucher's credit turns Available an hour after the charge (the catalog's
 *  rule for every open voucher; Story at once is a catalog detail the read
 *  path applies — here the charge time is the event's). */
function availableAtFromSession(session: Record<string, unknown>, createdSec?: number): string | null {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  if (meta.voucher === "voucher_story") return null;
  const base = (createdSec ?? Math.floor(Date.now() / 1000)) * 1000;
  return new Date(base + 3600 * 1000).toISOString();
}
