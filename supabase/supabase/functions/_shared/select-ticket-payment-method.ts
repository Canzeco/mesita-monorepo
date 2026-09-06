// THE TICKET v4 step 5 (MESITA-1114): guests pick how they settle.
// Two live paths: pay the place, or Mesita Pay (MESITA-1414 — gated per
// ticket by settlement.cardRail, consumer-web-get-ticket).
//
// The legacy `mesita` value stays 410 — old clients must not write it. That
// door closed for good: `mesita_pay` is the real gateway, a new value
// rather than a revival of the old C2 one.

export type SelectablePayMethod = "at_place" | "mesita_pay" | null;

export type ParsePayMethodResult =
  | { ok: true; method: SelectablePayMethod }
  | { ok: false; status: 400 | 410; body: Record<string, unknown> };

const LIVE_METHODS = new Set(["at_place", "mesita_pay"]);

export function parseSelectTicketPaymentMethod(
  method: unknown,
): ParsePayMethodResult {
  if (method === "mesita") {
    return {
      ok: false,
      status: 410,
      body: {
        ok: false,
        code: "retired",
        error: "Card through Mesita is retired — pay at the place.",
      },
    };
  }
  if (method !== null && method !== undefined && !LIVE_METHODS.has(method as string)) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "method must be at_place, mesita_pay, or null" },
    };
  }
  return {
    ok: true,
    method: (method === "at_place" || method === "mesita_pay")
      ? method
      : null,
  };
}
