import type { PayWith } from "@/lib/api/tab";
import { payDraftExpired } from "@/lib/pay-draft";

// THE GUEST'S TICKET IN PROGRESS (MESITA-3879, moved here by MESITA-4061 so
// it is tested on its own). What the guest typed at /pay/place/<placeId>
// lives in localStorage, with one pending pointer once an amount is typed:
// while it is pending, /pay and every other place's Pay open it where it was
// left. Not the place-page PayDraft in ./pay-draft (session storage, its own
// steps): that one only lends this file its 30-minute expiry.

export type Stage = "bill" | "method" | "card" | "pay";
/** Every stage a stored draft may hold (MESITA-4117). */
export const STAGES: readonly Stage[] = ["bill", "method", "card", "pay"];
/** 10% · 15% · 20% · Other (MESITA-3876); no tip is Other with 0 typed. */
export type Tip = 10 | 15 | 20 | "other" | null;
export const TIP_CHIPS = [10, 15, 20] as const;

export type Draft = {
  stage: Stage;
  typing: boolean;
  amount: string;
  tip: Tip;
  other: string;
  useCredit: boolean;
  method: PayWith | null;
  cardId: string | null;
  /** The card just refused: never preselected again (MESITA-4117). */
  refusedCardId?: string | null;
  /** The bill this draft became (MESITA-3997): while it is set, every way
   *  back in (the place's Pay, a reload, the X and back) opens that bill's
   *  QR, never the Bill step again. Cancel bill and Start again clear it. */
  sentTabId?: string | null;
  savedAt: number;
};

const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-lead.${placeId}`;
/** The last tip chip sent at this place (MESITA-3713); it survives the draft. */
const LAST_TIP_KEY = (placeId: string) => `mesita.pay.last-tip.${placeId}`;
/** The place whose ticket is in progress (MESITA-3879). */
const PENDING_KEY = "mesita.pay.pending-ticket";
/** The pending ticket's place name, for the banner on the tabs (MESITA-3906). */
export const PENDING_NAME_KEY = "mesita.pay.pending-ticket-name";

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastTip(placeId: string): Tip {
  try {
    const n = Number(store()?.getItem(LAST_TIP_KEY(placeId)));
    return (TIP_CHIPS as readonly number[]).includes(n) ? (n as Tip) : null;
  } catch {
    return null;
  }
}

export function writeLastTip(placeId: string, tip: Tip) {
  if (typeof tip !== "number") return;
  try {
    store()?.setItem(LAST_TIP_KEY(placeId), String(tip));
  } catch {
    /* storage can be blocked */
  }
}

export function readDraft(placeId: string): Draft | null {
  try {
    const d = JSON.parse(store()?.getItem(DRAFT_KEY(placeId)) ?? "null") as Draft | null;
    if (!d || typeof d.amount !== "string" || typeof d.savedAt !== "number") return null;
    if (payDraftExpired(d.savedAt, Date.now())) return null;
    // A stored stage is never trusted (MESITA-4117): an unknown one reads as
    // Bill, and a junk method or card id as none.
    const stage = STAGES.includes(d.stage) ? d.stage : "bill";
    const method = d.method === "card" || d.method === "cash" ? d.method : null;
    const cardId = typeof d.cardId === "string" ? d.cardId : null;
    const refusedCardId = typeof d.refusedCardId === "string" ? d.refusedCardId : null;
    return { ...d, stage, method, cardId, refusedCardId };
  } catch {
    return null;
  }
}

/** Saves the draft, stamped now; null removes it. A ticket is pending once
 *  an amount is typed ("0" counts: the pointer's test is `amount !== ""`). */
export function writeDraft(placeId: string, d: Omit<Draft, "savedAt"> | null) {
  const s = store();
  if (!s) return;
  try {
    if (d) s.setItem(DRAFT_KEY(placeId), JSON.stringify({ ...d, savedAt: Date.now() }));
    else s.removeItem(DRAFT_KEY(placeId));
    const pending = s.getItem(PENDING_KEY);
    if (d && d.amount !== "") s.setItem(PENDING_KEY, placeId);
    else if (pending === placeId) {
      s.removeItem(PENDING_KEY);
      s.removeItem(PENDING_NAME_KEY);
    }
  } catch {
    // The bill starts empty next time; nothing breaks.
  }
}

/** The place with a ticket in progress (an amount typed, not expired), or null. */
export function pendingTicketPlace(): string | null {
  const s = store();
  if (!s) return null;
  try {
    const placeId = s.getItem(PENDING_KEY);
    if (!placeId) return null;
    const d = readDraft(placeId);
    if (d && d.amount !== "") return placeId;
    s.removeItem(PENDING_KEY);
    return null;
  } catch {
    return null;
  }
}

/** The ticket in progress and its place's name (null when not known yet). */
export function pendingTicket(): { placeId: string; name: string | null } | null {
  const placeId = pendingTicketPlace();
  if (!placeId) return null;
  try {
    return { placeId, name: store()?.getItem(PENDING_NAME_KEY) ?? null };
  } catch {
    return { placeId, name: null };
  }
}

/** Cancel bill, the receipt and Close on Not paid clear what was typed at
 *  this place, and its pending pointer; another place's pointer stays. */
export function clearGuestDraft(placeId: string) {
  writeDraft(placeId, null);
}

/** "Start again" reopens what was typed, keypad down, at the given stage
 *  (MESITA-4121: Card when the bill's card failed, Method when it expired or
 *  was rejected, Bill otherwise). At Card the card that failed is excluded:
 *  listed, never preselected. A draft older than 30 minutes is gone, so the
 *  bill opens empty. */
export function reopenGuestDraft(placeId: string, stage: Stage = "bill") {
  const d = readDraft(placeId);
  if (!d) return;
  const failedCard = stage === "card" ? (d.cardId ?? d.refusedCardId ?? null) : (d.refusedCardId ?? null);
  writeDraft(placeId, {
    ...d,
    stage,
    typing: false,
    sentTabId: null,
    method: stage === "card" ? "card" : d.method,
    cardId: stage === "card" ? null : d.cardId,
    refusedCardId: failedCard,
  });
}

// ONE PAYMENT PER TAP (MESITA-4061). A pay call that times out or loses the
// network may still have opened the bill (and held the card) on the server.
// Until that same request id gets an answer the outcome is unknown: the
// screen keeps the id, so the next tap of Pay resends it and the server
// answers once, and nothing the guest changes in between may mint a new one.

/** After a failed pay call: a refusal (an error code) is a known outcome;
 *  a timeout or a lost connection (no code) is not. */
export function outcomeUnknownAfter(code: string | null): boolean {
  return code === null;
}

/** The request id after the guest changes what they typed: a fresh call gets
 *  a fresh id, unless the last call's outcome is still unknown. */
export function requestIdAfterEdit(prev: string | null, outcomeUnknown: boolean): string | null {
  return outcomeUnknown ? prev : null;
}
