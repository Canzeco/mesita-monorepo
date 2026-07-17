// Pure heuristic/parser helpers for Staff WhatsApp intent (no LLM calls).

import { extractConsumerCodeFromText } from "./consumer-code.ts";
import {
  type BillDraft,
  messageLooksLikeBill,
  parseBillParts,
} from "./staff-bill-draft.ts";

export type StaffMessageIntent = {
  intent:
    | "lookup_code"
    | "submit_bill"
    | "confirm_payment"
    | "select_project"
    | "cancel"
    | "help"
    | "unknown";
  consumer_code: string | null;
  check_subtotal_cents: number | null;
  tip_cents: number | null;
  confirm: boolean | null;
  /** 0-based index when staff picks unit 1, 2, … */
  place_index: number | null;
};

const EMPTY_INTENT: StaffMessageIntent = {
  intent: "unknown",
  consumer_code: null,
  check_subtotal_cents: null,
  tip_cents: null,
  confirm: null,
  place_index: null,
};

export function isPaymentConfirmState(sessionState: string): boolean {
  return sessionState === "awaiting_staff_payment_confirm" ||
    sessionState === "awaiting_payment_confirm";
}

export function heuristicParse(
  body: string,
  sessionState: string,
  pendingBill?: BillDraft,
): StaffMessageIntent {
  const lower = body.trim().toLowerCase();
  if (/^(help|\?|menu|ayuda|comandos)\b/.test(lower)) {
    return { ...EMPTY_INTENT, intent: "help" };
  }
  if (/^(cancel|cancelar|reset|stop|reiniciar)\b/.test(lower)) {
    return { ...EMPTY_INTENT, intent: "cancel" };
  }

  if (sessionState === "selecting_project") {
    const numOnly = body.trim().match(/^(\d+)$/);
    if (numOnly) {
      return {
        ...EMPTY_INTENT,
        intent: "select_project",
        place_index: Number(numOnly[1]) - 1,
      };
    }
  }

  const code = extractConsumerCodeFromText(body);

  if (isPaymentConfirmState(sessionState)) {
    if (
      /^(yes|y|si|sí|confirm|confirmed|pagado|paid|listo|ok|cobrado|cobra|ya\s+cobr|hecho|done)\b/i
        .test(lower) ||
      /\b(ya\s+)?cobr[eé]\b/i.test(lower)
    ) {
      return { ...EMPTY_INTENT, intent: "confirm_payment", confirm: true };
    }
    if (!messageLooksLikeBill(body)) {
      return EMPTY_INTENT;
    }
  }

  if (code && (sessionState === "idle" || sessionState === "consumer_identified")) {
    const parts = parseBillParts(body);
    return {
      ...EMPTY_INTENT,
      intent: "lookup_code",
      consumer_code: code,
      check_subtotal_cents: parts.subtotal_cents,
      tip_cents: parts.tip_cents,
      confirm: null,
    };
  }

  if (sessionState === "consumer_identified" || sessionState === "idle") {
    const parts = parseBillParts(body);
    if (parts.subtotal_cents != null || parts.tip_cents != null) {
      return {
        ...EMPTY_INTENT,
        intent: "submit_bill",
        consumer_code: code,
        check_subtotal_cents: parts.subtotal_cents,
        tip_cents: parts.tip_cents,
        confirm: null,
      };
    }
    if (pendingBill?.subtotal_cents != null && /\d/.test(body)) {
      return { ...EMPTY_INTENT, intent: "submit_bill" };
    }
  }

  if (code) {
    return { ...EMPTY_INTENT, intent: "lookup_code", consumer_code: code };
  }

  if (isCasualStaffMessage(body)) {
    return { ...EMPTY_INTENT, intent: "unknown" };
  }

  if (sessionState === "consumer_identified" && /\d/.test(body)) {
    return { ...EMPTY_INTENT, intent: "submit_bill" };
  }

  return EMPTY_INTENT;
}

export function isCasualStaffMessage(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  return /^(hi|hello|hey|hola|buenas|buenos|qué tal|que tal|good morning|good afternoon|ok|vale|gracias|thanks)\b/i
    .test(t);
}
