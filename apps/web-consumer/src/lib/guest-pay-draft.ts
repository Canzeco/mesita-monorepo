// THE GUEST'S TICKET IN PROGRESS (MESITA-3879, moved here by MESITA-4061 so
// it is tested on its own). What the guest typed at /pay/place/<placeId>
// lives in localStorage, with one pending pointer once an amount is typed:
// while it is pending, /pay and every other place's Pay open it where it was
// left. A draft lives 30 minutes after its last change (MESITA-4305 moved
// the limit here when the old place-page draft and its step list went).

/** How long a draft lives after its last change. */
export const PAY_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

/** Whether a draft written at `savedAt` is past the limit at `now`. Exactly
 *  at the limit it is still good. */
export function payDraftExpired(savedAt: number, now: number): boolean {
  return now - savedAt > PAY_DRAFT_MAX_AGE_MS;
}

/** 10% · 15% · 20% · Other (MESITA-3876); no tip is Other with 0 typed. */
export type Tip = 10 | 15 | 20 | "other" | null;
export const TIP_CHIPS = [10, 15, 20] as const;

export type Draft = {
  amount: string;
  tip: Tip;
  other: string;
  useCredit: boolean;
  /** The bill this draft became (MESITA-3997): while it is set, every way
   *  back in (the place's Pay, a reload, the X and back) opens that bill's
   *  QR, never the Bill step again. Cancel bill and Start again clear it. */
  sentTabId?: string | null;
  savedAt: number;
};

const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-lead.${placeId}`;
/** The last tip chip sent at this place (MESITA-3713); it survives the draft. */
const LAST_TIP_KEY = (placeId: string) => `mesita.pay.last-tip.${placeId}`;
/** The last card picked (MESITA-4124): the default card a voucher checkout
 *  and Payment methods preselect (a bill has no card since MESITA-4708). */
const LAST_CARD_KEY = "mesita.pay.last-card";
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

/** MESITA-4524 (no zombie tickets): what the guest typed on Bill, Tip and
 *  Method is not a ticket. It lives in this page's memory only, never in
 *  localStorage, and is gone when the app closes; nothing ever resumes it as
 *  "Bill in progress". The last tip and the last card are preferences and
 *  stay in localStorage. */
type MemoryWindow = { __mesitaPayDraft?: Map<string, string> };
function draftStore(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as MemoryWindow;
  const m = (w.__mesitaPayDraft ??= new Map<string, string>());
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/** Drafts and the pending pointer a phone saved before MESITA-4524 are
 *  dropped once, so an old "Bill in progress" never comes back. */
function dropStoredDrafts() {
  const s = store();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k && (k.startsWith("mesita.pay.guest-lead.") || k === PENDING_KEY || k === PENDING_NAME_KEY)) s.removeItem(k);
    }
  } catch {
    /* storage can be blocked */
  }
}
let droppedStoredDrafts = false;

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

export function readLastCard(): string | null {
  try {
    const id = store()?.getItem(LAST_CARD_KEY);
    return id && id.length > 0 && id.length <= 128 ? id : null;
  } catch {
    return null;
  }
}

export function writeLastCard(cardId: string | null) {
  if (!cardId) return;
  try {
    store()?.setItem(LAST_CARD_KEY, cardId);
  } catch {
    /* storage can be blocked */
  }
}

export function readDraft(placeId: string): Draft | null {
  if (!droppedStoredDrafts) {
    droppedStoredDrafts = true;
    dropStoredDrafts();
  }
  try {
    const d = JSON.parse(draftStore()?.getItem(DRAFT_KEY(placeId)) ?? "null") as Draft | null;
    if (!d || typeof d.amount !== "string" || typeof d.savedAt !== "number") return null;
    if (payDraftExpired(d.savedAt, Date.now())) return null;
    return { amount: d.amount, tip: d.tip, other: d.other, useCredit: d.useCredit, sentTabId: d.sentTabId ?? null, savedAt: d.savedAt };
  } catch {
    return null;
  }
}

/** Saves the draft, stamped now; null removes it. A ticket is pending once
 *  an amount is typed ("0" counts: the pointer's test is `amount !== ""`). */
export function writeDraft(placeId: string, d: Omit<Draft, "savedAt"> | null) {
  const s = draftStore();
  if (!s) return;
  try {
    if (d) s.setItem(DRAFT_KEY(placeId), JSON.stringify({ ...d, savedAt: Date.now() }));
    else s.removeItem(DRAFT_KEY(placeId));
  } catch {
    // The bill starts empty next time; nothing breaks.
  }
}

/** The place with a ticket in progress (an amount typed, not expired), or null. */
export function pendingTicketPlace(): string | null {
  // MESITA-4524: a typed bill is never a pending ticket; only a live
  // server ticket is (the Pay page and banner read it from the server).
  return null;
}

/** Kept for the old pointer's shape; never read since MESITA-4524. */
export function legacyPendingTicketPlace(): string | null {
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

/** ← from the QR reopens what was typed (MESITA-4121), as a new ticket. A draft older than 30 minutes is gone, so the bill opens
 *  empty. */
export function reopenGuestDraft(placeId: string) {
  const d = readDraft(placeId);
  if (!d) return;
  writeDraft(placeId, { ...d, sentTabId: null });
}

// ONE PAYMENT PER TAP (MESITA-4061). A pay call that times out or loses the
// network may still have opened the bill on the server.
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
