// THE PAY DRAFT (MESITA-3759). What the guest typed at /pay/<placeId> is kept
// in the tab's session storage, so "Add a card" (which leaves the app) and a
// reload come back with the amounts kept. These are the pure rules for
// reading it back, React-free so they are tested on their own:
//
//   readPayDraft   the saved text as a draft, or null (no draft: Bill, with
//                  nothing typed, no method, no card, credit switch as new).
//                  The text is checked, never trusted: anything that is not
//                  an object, a savedAt that is not a real number, or an
//                  amount that is not text is no draft.
//   old step keys  "method" opens Methods and "review" opens Pay (their names
//                  before the six steps); a key nobody knows opens Bill.
//   the limit      a draft older than PAY_DRAFT_MAX_AGE_MS is no draft. A
//                  draft with no savedAt (saved before this rule) or one in
//                  the future (a wrong clock) is stamped now and KEPT: a
//                  deploy must never empty a draft a guest is in the middle of.
//   the tip rule   a draft with no tip answer never opens past Tip.
//   stampPayDraft  every write carries the time it was written.
//   payDraftExpired  the same limit, asked again when the tab is looked at
//                  after a while.

import { PAY_STEPS, type PayStepKey } from "@mesita/place-profile/lib/pay-steps";
import type { PayWith } from "@/lib/api/tab";
import { draftAmount, draftTip } from "@/lib/pay-keypad";

/** How long a draft lives after its last change. */
export const PAY_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

/** The place page's steps: Bill, Tip, Methods, Pay (2 to 5 of the six). */
export type PlacePayStep = Exclude<PayStepKey, "pick" | "sign">;
export const PLACE_PAY_STEPS: readonly PlacePayStep[] = PAY_STEPS.map((s) => s.key).filter(
  (k): k is PlacePayStep => k !== "pick" && k !== "sign",
);

export const TIP_PERCENTS = [10, 15, 20] as const;
export type TipPercent = (typeof TIP_PERCENTS)[number];
/** null: not answered yet. No tip is "other" with 0 typed. */
export type TipPick = TipPercent | "other" | null;

export type PayDraft = {
  step: PlacePayStep;
  amount: string;
  tip: TipPick;
  other: string;
  useCredit: boolean;
  method: PayWith | null;
  cardId: string | null;
  savedAt: number;
};

const OLD_STEP: Record<string, PlacePayStep> = { method: "methods", review: "pay" };

function readStep(v: unknown): PlacePayStep {
  if (typeof v !== "string") return "bill";
  const key = OLD_STEP[v] ?? v;
  return PLACE_PAY_STEPS.find((s) => s === key) ?? "bill";
}

/** Whether a draft written at `savedAt` is past the limit at `now`. Exactly
 *  at the limit it is still good. */
export function payDraftExpired(savedAt: number, now: number): boolean {
  return now - savedAt > PAY_DRAFT_MAX_AGE_MS;
}

/** The saved text as a draft; null when there is none to open. */
export function readPayDraft(raw: string | null, now: number): PayDraft | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  if (typeof d.amount !== "string") return null;
  let savedAt: number;
  if (d.savedAt === undefined) savedAt = now;
  else if (typeof d.savedAt !== "number" || !Number.isFinite(d.savedAt)) return null;
  else if (d.savedAt > now) savedAt = now;
  else if (payDraftExpired(d.savedAt, now)) return null;
  else savedAt = d.savedAt;
  // An older draft may say "none": that is unanswered now.
  const tip: TipPick = d.tip === "other" ? "other" : TIP_PERCENTS.find((p) => p === d.tip) ?? null;
  const step = readStep(d.step);
  return {
    // Never past Tip with the tip unanswered.
    step: tip === null && PLACE_PAY_STEPS.indexOf(step) > PLACE_PAY_STEPS.indexOf("tip") ? "tip" : step,
    // Amounts go into the keypad's own form, so a key never extends text
    // it could not have made.
    amount: draftAmount(d.amount),
    tip,
    other: draftTip(typeof d.other === "string" ? d.other : ""),
    useCredit: typeof d.useCredit === "boolean" ? d.useCredit : true,
    method: d.method === "cash" || d.method === "card" ? d.method : null,
    cardId: typeof d.cardId === "string" ? d.cardId : null,
    savedAt,
  };
}

/** The text to save: the draft with the time it was written. */
export function stampPayDraft(d: Omit<PayDraft, "savedAt">, now: number): string {
  return JSON.stringify({ ...d, savedAt: now });
}
