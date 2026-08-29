// THE TICKET v4 step 5 (MESITA-1114): guests pick how they settle.
// Exactly one live path: pay the place.
//
// The legacy `mesita` value stays 410 — old clients must not write it. That
// is a CLOSED DOOR, not a dead rail: Mesita Pay is staged (Connect account
// layer in #1415, the guest's saved cards in Me › More › Cards), and the
// gateway PR reopens this door with a NEW method value rather than reviving
// the old C2 one.

export type SelectablePayMethod = "at_place" | null;

export type ParsePayMethodResult =
  | { ok: true; method: SelectablePayMethod }
  | { ok: false; status: 400 | 410; body: Record<string, unknown> };

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
  if (method !== null && method !== undefined && method !== "at_place") {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "method must be at_place or null" },
    };
  }
  return { ok: true, method: method === "at_place" ? "at_place" : null };
}
