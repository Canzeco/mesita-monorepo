import { assertEquals } from "jsr:@std/assert@1";
import { lineFor, parseRefillBody, REFILL_MAX_IDS, runRefill } from "./premier-refill.ts";

// MESITA-3163: Manage Multiple › Refill. Money: every ID gets exactly one
// line, a refusal keeps its code, and an RPC that did not answer is unknown
// (Retry unfinished resends it with the same requestId) — never ok.

const G = (n: number) => `ChIJ${String(n).padStart(23, "0")}`;
const REQ = "req-0000-0001";

Deno.test("parseRefillBody refuses each bad field with its code", () => {
  const ok = { action: "refill", googlePlaceIds: [G(1)], tier: 2, days: 30, requestId: REQ };
  const rows: [Record<string, unknown>, string][] = [
    [{ ...ok, googlePlaceIds: "ChIJ" }, "ids_invalid"],
    [{ ...ok, googlePlaceIds: [] }, "ids_invalid"],
    [{ ...ok, googlePlaceIds: [G(1), ""] }, "ids_invalid"],
    [{ ...ok, googlePlaceIds: Array.from({ length: REFILL_MAX_IDS + 1 }, (_, i) => G(i)) }, "too_many_ids"],
    [{ ...ok, tier: 3 }, "tier_invalid"],
    [{ ...ok, tier: 0 }, "tier_invalid"],
    [{ ...ok, days: 0 }, "days_invalid"],
    [{ ...ok, days: 367 }, "days_invalid"],
    [{ ...ok, days: 1.5 }, "days_invalid"],
    [{ ...ok, requestId: undefined }, "request_id_invalid"],
    [{ ...ok, requestId: "short" }, "request_id_invalid"],
  ];
  for (const [body, code] of rows) {
    const r = parseRefillBody(body);
    assertEquals("code" in r ? r.code : "parsed", code, JSON.stringify(body).slice(0, 80));
  }
});

Deno.test("parseRefillBody sends duplicate IDs once; End Mesita days needs no tier, days or requestId", () => {
  assertEquals(
    parseRefillBody({ action: "refill", googlePlaceIds: [G(1), ` ${G(1)} `, G(2)], tier: 1, days: 366, requestId: REQ }),
    { action: "refill", googlePlaceIds: [G(1), G(2)], tier: 1, days: 366, requestId: REQ },
  );
  assertEquals(
    parseRefillBody({ action: "end_mesita_days", googlePlaceIds: [G(1), G(1)] }),
    { action: "end_mesita_days", googlePlaceIds: [G(1)] },
  );
  // 500 distinct IDs pass; the cap counts after dedupe.
  const r = parseRefillBody({
    action: "end_mesita_days",
    googlePlaceIds: [...Array.from({ length: REFILL_MAX_IDS }, (_, i) => G(i)), G(0)],
  });
  assertEquals("code" in r, false);
});

Deno.test("lineFor maps ok, replayed, refused and anything else to unknown", () => {
  assertEquals(lineFor(G(1), "p1", { result: "ok", replayed: false, ends_at_2x: null, ends_at_5x: "2026-12-03T00:00:00Z" }), {
    googlePlaceId: G(1),
    placeId: "p1",
    result: "ok",
    replayed: false,
    ends_at_2x: null,
    ends_at_5x: "2026-12-03T00:00:00Z",
  });
  assertEquals(lineFor(G(1), "p1", { result: "ok", ended_days: 40 }).ended_days, 40);
  assertEquals(lineFor(G(1), "p1", { result: "refused", code: "paid_higher" }), {
    googlePlaceId: G(1),
    placeId: "p1",
    result: "refused",
    code: "paid_higher",
  });
  for (const reply of [null, {}, { result: "refused" }, { result: "maybe" }]) {
    assertEquals(lineFor(G(1), "p1", reply).result, "unknown", JSON.stringify(reply));
  }
});

Deno.test("runRefill answers one line per ID, in order: not_found, ok, refused, unknown", async () => {
  const calls: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  const lines = await runRefill(
    { action: "refill", googlePlaceIds: [G(1), G(2), G(3), G(4)], tier: 2, days: 30, requestId: REQ },
    {
      resolve: () => Promise.resolve(new Map([[G(2), "p2"], [G(3), "p3"], [G(4), "p4"]])),
      rpc: (fn, args) => {
        calls.push({ fn, ...args });
        if (args.p_place_id === "p3") return Promise.resolve({ data: { result: "refused", code: "cap_reached" }, error: null });
        if (args.p_place_id === "p4") return Promise.resolve({ data: null, error: { message: "timeout" } });
        return Promise.resolve({ data: { result: "ok", replayed: true, ends_at_2x: null, ends_at_5x: "x" }, error: null });
      },
      by: "pato@mesita.ai",
      requestId: REQ,
      log: (e) => logs.push(e),
    },
  );
  assertEquals(lines.map((l) => [l.googlePlaceId, l.result, l.code ?? null]), [
    [G(1), "refused", "not_found"],
    [G(2), "ok", null],
    [G(3), "refused", "cap_reached"],
    [G(4), "unknown", null],
  ]);
  assertEquals(lines[1].replayed, true);
  // One RPC per place found, each with the press's requestId and source admin.
  assertEquals(calls.length, 3);
  for (const c of calls) {
    assertEquals([c.fn, c.p_tier, c.p_days, c.p_source, c.p_request_id], ["premier_add_days", 2, 30, "admin", REQ]);
  }
  // Each line is logged once.
  assertEquals(logs.length, 4);
  assertEquals(logs.every((l) => l.request_id === REQ), true);
});

Deno.test("runRefill End Mesita days calls premier_end_mesita_days and carries ended_days", async () => {
  const lines = await runRefill(
    { action: "end_mesita_days", googlePlaceIds: [G(1)] },
    {
      resolve: () => Promise.resolve(new Map([[G(1), "p1"]])),
      rpc: (fn, args) => {
        assertEquals([fn, args.p_place_id, args.p_by], ["premier_end_mesita_days", "p1", "pato@mesita.ai"]);
        return Promise.resolve({ data: { result: "ok", ended_days: 12, ends_at_2x: null, ends_at_5x: null }, error: null });
      },
      by: "pato@mesita.ai",
      requestId: REQ,
      log: () => {},
    },
  );
  assertEquals([lines[0].result, lines[0].ended_days], ["ok", 12]);
});
