// ANONYMOUS MODE (MESITA-4246, Pato 2026-11-17). A visitor with no session,
// or signed in but not onboarded, explores Home, Search, places and Social.
// Every Edge Function call goes through invokeEF, and invokeEF asks this
// module first, so ONE table decides what an anonymous visitor may call:
//
//   open    public reads and the sign-in/onboarding calls: go through.
//   quiet   tracking and background reads: answered without a call, so no
//           social event, no 401 and no paid Google call ever leaves.
//   action  a real action on an open screen (Save, Buy, a person, Ask): the
//           visitor is sent to Sign with `next` = where they stand, and
//           comes back.
//
// A function missing from the table fails quietly without a call (a member
// read on a shared component, a write on a walled screen): nothing leaves,
// and nothing yanks the visitor to Sign while a page loads. Walled screens
// never render for an anonymous visitor anyway (the proxy and the layout).
//
// The viewer is set by ConsumerIdentityProvider from the layout's server
// read. `unknown` (a session whose profile read failed) is not anonymous:
// its actions go through, only tracking stays quiet (MESITA-4246, E7).

import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { withNext } from "@/lib/auth-redirect";
import { signActionFromNext, type SignAction } from "@/lib/sign-intent";

export type Viewer = "anonymous" | "member" | "unknown";

let viewer: Viewer = "member";

export function setViewer(v: Viewer): void {
  viewer = v;
}

// NO SESSION, NO MEMBER READ (Pato, 2026-11-18, MESITA-4317: "you are
// expiring the anonymous session too soon"). There is no anonymous session
// to expire: a visitor without an account holds no session at all. But the
// bar's avatar and a place card's actions read the profile, the profile
// function answers 401 without a session, and that 401 left for
// /auth/clear-session and then said "Your session expired. Sign in again."
// The calls below need a session (a visitor signed in but not onboarded
// makes them on Sign and Onboard), so invokeEF asks the browser's own
// session store first (a local read, no network) and, without one, they
// never leave.
export const NEEDS_SESSION = new Set([
  "consumer-web-signin-phone",
  "consumer-web-get-profile",
  "consumer-web-update-profile",
  "consumer-web-claim-instagram",
]);

export function currentViewer(): Viewer {
  return viewer;
}

const OPEN = new Set([
  "consumer-web-get-place",
  "consumer-web-list-places",
  "consumer-web-list-catalog",
  "consumer-web-record-premier-ad",
  "consumer-web-list-vouchers",
  "consumer-web-get-gift-preview",
  "consumer-web-get-pay-place-name",
  "consumer-web-list-activity",
  "consumer-web-list-place-likes",
  // Sign and onboarding run while the visitor is still anonymous.
  "consumer-web-signin-phone",
  "consumer-web-get-profile",
  "consumer-web-update-profile",
  "consumer-web-claim-instagram",
]);

const QUIET = new Set([
  "consumer-web-track-event",
  "consumer-web-track-place-share",
  "consumer-web-list-saved-places",
  "consumer-web-list-saved-locations",
  "consumer-web-list-reservations",
  "consumer-web-list-cards",
  "consumer-web-list-pay-notifications",
  "consumer-web-list-pay-places",
  "consumer-web-list-visits",
  "consumer-web-get-wallet",
  "consumer-web-get-plan",
  "consumer-web-get-premier-refill",
  // Paid Google calls: anonymous Search lists stored places only.
  "consumer-web-reverse-geocode",
  "consumer-web-suggest-places",
]);

/** `answer` null: no call and a quiet failure (the caller's own empty or
 *  error state), for reads whose empty shape is not a plain list. */
// Actions an open screen offers. Reserve, Ask, Pay and adding a place are
// walled routes, so the proxy sends those to Sign before any call.
const ACTION = new Set([
  "consumer-web-get-person",
  "consumer-web-buy-voucher",
  "consumer-web-add-loyalty-card",
  "consumer-web-save-location",
  "consumer-web-report-place",
  "consumer-web-ask-memo",
  "consumer-web-claim-credit",
  "consumer-web-send-credit",
  "consumer-web-start-payment",
  "consumer-web-create-reservation",
]);

export type AnonymousGate =
  | { kind: "pass" }
  | { kind: "quiet"; answer: Record<string, unknown> | null }
  | { kind: "sign"; intent: SignIntent | null };

/** What a pending action was, so Sign can say why and finish it after. */
export type SignIntent = { kind: "save"; placeId: string };

// What a quiet call answers: the empty shape its caller already handles.
const QUIET_ANSWER: Record<string, Record<string, unknown>> = {
  "consumer-web-track-event": {},
  "consumer-web-track-place-share": {},
  "consumer-web-suggest-places": { predictions: [], idleSec: null },
  "consumer-web-list-saved-places": { ids: [], places: [] },
  "consumer-web-list-saved-locations": { locations: [] },
  "consumer-web-list-reservations": { reservations: [] },
  "consumer-web-list-cards": { cards: [], test_mode: false },
  "consumer-web-list-pay-places": { places: [] },
  "consumer-web-list-visits": { visits: [], truncated: false },
};

/** The gate for one call (pure: the viewer and the call in, a verdict out). */
export function anonymousGate(
  v: Viewer,
  fn: string,
  body: Record<string, unknown>,
  held = true,
): AnonymousGate {
  if (v === "member") return { kind: "pass" };
  if (!held && NEEDS_SESSION.has(fn)) {
    return { kind: "quiet", answer: null };
  }
  if (OPEN.has(fn)) return { kind: "pass" };
  const isSave =
    fn === "consumer-web-track-activity" &&
    body.kind === "saved" &&
    body.on !== false;
  // A session whose profile read failed (`unknown`) still reads and acts;
  // only its tracking stays quiet (MESITA-4246, E7).
  if (v === "unknown") {
    const tracking =
      fn === "consumer-web-track-event" ||
      fn === "consumer-web-track-place-share" ||
      (fn === "consumer-web-track-activity" && !isSave);
    return tracking
      ? { kind: "quiet", answer: QUIET_ANSWER[fn] ?? {} }
      : { kind: "pass" };
  }
  if (fn === "consumer-web-track-activity") {
    // A view is tracking; a save is the visitor's own act.
    if (isSave) {
      const placeId = typeof body.place_id === "string" ? body.place_id : "";
      return {
        kind: "sign",
        intent: placeId ? { kind: "save", placeId } : null,
      };
    }
    // A SIGNED-OUT VIEW COUNTS (Pato, 2026-11-18, MESITA-4326: "counts
    // only"): the function writes a view with no person; nothing names it.
    if (body.kind === "viewed") return { kind: "pass" };
    return { kind: "quiet", answer: { kind: body.kind, on: false } };
  }
  if (QUIET.has(fn)) return { kind: "quiet", answer: QUIET_ANSWER[fn] ?? null };
  if (ACTION.has(fn)) return { kind: "sign", intent: null };
  return { kind: "quiet", answer: null };
}

const INTENT_KEY = "mesita.signIntent";

/** The pending action, kept for the tab across Sign (sessionStorage). */
export function saveSignIntent(intent: SignIntent | null): void {
  try {
    if (intent)
      sessionStorage.setItem(
        INTENT_KEY,
        JSON.stringify({ ...intent, at: Date.now() }),
      );
    else sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // Private mode: the visitor signs in and taps Save again.
  }
}

/** Read and clear the pending action. One use, and only for 30 minutes, so
 *  a link can never carry a write (MESITA-4246, E5). */
export function takeSignIntent(): SignIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as {
      kind?: unknown;
      placeId?: unknown;
      at?: unknown;
    };
    if (typeof v.at !== "number" || Date.now() - v.at > 30 * 60_000)
      return null;
    if (v.kind === "save" && typeof v.placeId === "string")
      return { kind: "save", placeId: v.placeId };
    return null;
  } catch {
    return null;
  }
}

/** Where Sign sends an anonymous visitor back to: the page they are on. */
export function signHref(next: string): string {
  return withNext(CONSUMER_ROUTES.sign, next);
}

// ASK BEFORE SENDING (Pato, 2026-11-17, MESITA-4288: "likes or reservations
// or offers require sign and display the modal before aggressively
// redirecting"): a gated tap no longer jumps to Sign. It opens SignGateModal,
// which says why ("Sign in to save places") and offers Sign in
// or Not now. Only Continue keeps the intent and goes to Sign.

/** Why the modal is up: a save, or what the target path is for. */
export type SignGateReason = "save" | SignAction;

/** One pending ask: where Sign returns to, and the action it finishes. */
export type SignGate = {
  next: string;
  intent: SignIntent | null;
  reason: SignGateReason;
};

let gate: SignGate | null = null;
const gateListeners = new Set<() => void>();

function setGate(g: SignGate | null): void {
  gate = g;
  for (const l of gateListeners) l();
}

export function subscribeSignGate(l: () => void): () => void {
  gateListeners.add(l);
  return () => gateListeners.delete(l);
}

export function currentSignGate(): SignGate | null {
  return gate;
}

/** Ask the visitor to sign in for `next` (a path in this app). */
export function openSignGate(next: string, intent: SignIntent | null): void {
  setGate({
    next,
    intent,
    reason: intent?.kind === "save" ? "save" : signActionFromNext(next),
  });
}

export function closeSignGate(): void {
  setGate(null);
}

/** Sign in: keep the intent for the tab, then go to Sign. */
export function continueToSign(g: SignGate): void {
  if (typeof window === "undefined") return;
  saveSignIntent(g.intent);
  setGate(null);
  window.location.assign(signHref(g.next));
}

/** A gated action where the visitor stands: ask first (browser only). */
export function requestSignIn(intent: SignIntent | null): void {
  if (typeof window === "undefined") return;
  openSignGate(`${window.location.pathname}${window.location.search}`, intent);
}
