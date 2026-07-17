// Partial bill amounts across multiple WhatsApp messages (session.context).

import { toCents } from "./money.ts";
import { hasBillLabels } from "./staff-bill-parse.ts";

export type BillDraft = {
  subtotal_cents: number | null;
  tip_cents: number | null;
};

export {
  hasBillLabels,
  messageLooksLikeBill,
  parseBillParts,
  stripConsumerCodesForBillParse,
} from "./staff-bill-parse.ts";

export function billDraftFromContext(
  context: Record<string, unknown>,
): BillDraft {
  const raw = context.pending_bill;
  if (!raw || typeof raw !== "object") {
    return { subtotal_cents: null, tip_cents: null };
  }
  const o = raw as Record<string, unknown>;
  return {
    subtotal_cents: toCents(o.subtotal_cents),
    tip_cents: toCents(o.tip_cents),
  };
}

export function billDraftToContext(draft: BillDraft): Record<string, unknown> {
  return {
    subtotal_cents: draft.subtotal_cents,
    tip_cents: draft.tip_cents,
  };
}

/** LLM sometimes returns pesos (850) instead of cents (85000). */
export function normalizeLlmBillCents(v: number | null): number | null {
  if (v == null) return null;
  const n = Math.trunc(v);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  // 1–9999 → almost certainly pesos from the model
  if (n < 10000) return n * 100;
  return n;
}

/**
 * Merge amounts from a new message into the session draft.
 * If subtotal was already saved and the waiter sends one more number without labels, treat it as tip.
 */
export function mergeBillDraft(
  existing: BillDraft,
  parts: BillDraft,
  latestMessage: string,
): BillDraft {
  let subtotal = parts.subtotal_cents ?? existing.subtotal_cents;
  let tip = parts.tip_cents ?? existing.tip_cents;

  const singleNumber =
    parts.subtotal_cents != null && parts.tip_cents == null &&
    !hasBillLabels(latestMessage);

  if (
    singleNumber &&
    existing.subtotal_cents != null &&
    existing.tip_cents == null &&
    parts.subtotal_cents != null
  ) {
    return {
      subtotal_cents: existing.subtotal_cents,
      tip_cents: parts.subtotal_cents,
    };
  }

  if (parts.subtotal_cents != null) subtotal = parts.subtotal_cents;
  if (parts.tip_cents != null) tip = parts.tip_cents;

  return { subtotal_cents: subtotal, tip_cents: tip };
}

/** Combine regex parse + LLM fields, then merge into session draft. */
export function buildIncomingBill(
  body: string,
  parts: BillDraft,
  intent: {
    check_subtotal_cents: number | null;
    tip_cents: number | null;
  },
  draft: BillDraft,
): BillDraft {
  const fromIntent: BillDraft = {
    subtotal_cents: normalizeLlmBillCents(intent.check_subtotal_cents),
    tip_cents: normalizeLlmBillCents(intent.tip_cents),
  };

  const incoming: BillDraft = {
    subtotal_cents: parts.subtotal_cents ?? fromIntent.subtotal_cents,
    tip_cents: parts.tip_cents ?? fromIntent.tip_cents,
  };

  return mergeBillDraft(draft, incoming, body);
}

export function isBillDraftReady(draft: BillDraft): boolean {
  return draft.subtotal_cents != null && draft.subtotal_cents > 0;
}

export function billDraftHasAnyAmount(draft: BillDraft): boolean {
  return draft.subtotal_cents != null || draft.tip_cents != null;
}

export function billDraftNeedMessage(draft: BillDraft): string {
  if (draft.subtotal_cents == null) {
    return "Manda el subtotal (ej. SUBTOTAL 850, solo 850, o «la cuenta fue 850»).";
  }
  return "Manda el subtotal de la cuenta (ej. 850 o SUBTOTAL 850). El descuento Mesita aplica solo al subtotal — sin propina.";
}
