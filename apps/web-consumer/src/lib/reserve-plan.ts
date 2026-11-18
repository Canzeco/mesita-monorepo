// The reserve flow's plan rules (MESITA-4393): how many reservations are
// left, when the cap applies, when Pro is offered, the draft that survives
// Stripe Checkout and where the guest lands on the way back. Pure, so the
// money path is tested without the form (lib/__tests__/reserve-plan.test.ts).
//
//   capApplies   the duplicate check is done, no live table here (a change
//                never counts), the server sent both flags (an old EF fails
//                open) and the admin testing switch is off
//   offerPro     Free, no operator cap, used < Pro's cap, none left
//   blocked      none left and the cap applies
//
// The server still enforces the cap at submit (consumer-web-create-
// reservation); every rule here fails open.

import type { GuestPlanView } from "@/lib/api/plan";
import { PRO_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";

/** Both flags arrived (the EF that sends them is deployed). */
export function flagsPresent(view: GuestPlanView | null): boolean {
  return (
    !!view &&
    typeof view.cap_lifted === "boolean" &&
    typeof view.cap_override === "boolean"
  );
}

export function left(view: GuestPlanView): number {
  return Math.max(view.cap - view.used, 0);
}

/** The one gate for every count, notice, offer and disabled Reserve. */
export function capApplies(args: {
  view: GuestPlanView | null;
  checking: boolean;
  hasLiveTable: boolean;
}): boolean {
  const { view } = args;
  return (
    !args.checking &&
    !args.hasLiveTable &&
    flagsPresent(view) &&
    view!.cap_lifted === false
  );
}

/** None left. Only meaningful when capApplies. */
export function blocked(view: GuestPlanView | null): boolean {
  return flagsPresent(view) && view!.cap_lifted === false && left(view!) === 0;
}

/** Pro would unblock this guest: offer it. */
export function offerPro(view: GuestPlanView | null): boolean {
  return (
    blocked(view) &&
    view!.plan === "free" &&
    view!.cap_override === false &&
    view!.used < PRO_RESERVATIONS_PER_MONTH
  );
}

/** Where Checkout comes back: this page with pro=1 and no old plan id;
 *  other query params stay. */
export function proReturnUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("plan");
  url.searchParams.set("pro", "1");
  return url.toString();
}

// ── The draft ────────────────────────────────────────────────────────────

/** A draft lives this long in the tab (sessionStorage). */
export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export type ReserveDraft = {
  savedAt: number;
  dateChoice: string;
  timeChoice: string | null;
  timeWindow: number;
  party: number;
  notes: string;
  firstName: string;
  lastName: string;
  onConfirm: string;
  onReject: string;
  stepAt: number;
};

export function draftKey(placeId: string): string {
  return `reserve-draft:${placeId}`;
}

export function encodeDraft(draft: ReserveDraft): string {
  return JSON.stringify(draft);
}

const str = (v: unknown, max = 500): v is string =>
  typeof v === "string" && v.length <= max;
const int = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

/** The saved draft, or null when it is missing, malformed, from the future
 *  or older than DRAFT_TTL_MS. Never throws. */
export function decodeDraft(raw: string | null, now: number): ReserveDraft | null {
  if (!raw) return null;
  let d: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    d = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof d.savedAt !== "number" || !Number.isFinite(d.savedAt)) return null;
  if (d.savedAt > now || now - d.savedAt > DRAFT_TTL_MS) return null;
  if (
    !str(d.dateChoice, 20) ||
    !(d.timeChoice === null || str(d.timeChoice, 10)) ||
    !int(d.timeWindow, 0, 600) ||
    !int(d.party, 1, 50) ||
    !str(d.notes, 2000) ||
    !str(d.firstName, 60) ||
    !str(d.lastName, 60) ||
    !str(d.onConfirm, 20) ||
    !str(d.onReject, 20) ||
    !int(d.stepAt, 0, 2)
  )
    return null;
  return d as unknown as ReserveDraft;
}

// ── The way back from Checkout ───────────────────────────────────────────

export type ReturnOutcome =
  /** Not a Checkout return: the form as usual. */
  | { kind: "none" }
  /** Paid: back on the You step with the new count. */
  | { kind: "paid" }
  /** Stripe has not settled: stay on the Pro step, Try again only. */
  | { kind: "pending" }
  /** The payment read failed or said nothing: Pro step with an error. */
  | { kind: "check_failed" }
  /** Cancel or browser Back: the Pro step again, when Pro still helps. */
  | { kind: "offer" }
  /** Back with the marker but Pro no longer helps: the form as usual. */
  | { kind: "form" };

export function returnOutcome(args: {
  hasProMarker: boolean;
  sessionId: string | null;
  view: GuestPlanView | null;
  readFailed: boolean;
}): ReturnOutcome {
  if (!args.hasProMarker && !args.sessionId) return { kind: "none" };
  if (args.sessionId) {
    if (args.readFailed || !args.view) return { kind: "check_failed" };
    if (args.view.confirmed === "paid") return { kind: "paid" };
    if (args.view.confirmed === "pending") return { kind: "pending" };
    // No verdict (Stripe unreachable or not configured): trust the plan.
    return args.view.plan === "premium" ? { kind: "paid" } : { kind: "check_failed" };
  }
  return offerPro(args.view) ? { kind: "offer" } : { kind: "form" };
}
