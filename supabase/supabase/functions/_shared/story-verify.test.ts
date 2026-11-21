import { assertEquals } from "jsr:@std/assert@1";
import { cleanHandle, narrowQuestion, narrowVerdictFrom, openVerdictFrom, verifyImage } from "./story-verify.ts";
import { instagramHandleOfUrl } from "./place-instagram.ts";

const CANDS = [
  { place_id: "00000000-0000-4000-8000-000000000001", handle: "orinoco", name: "Taquería Orinoco", google_name: null },
  { place_id: "00000000-0000-4000-8000-000000000002", handle: null, name: "Café Dos", google_name: "Cafe Dos Roma" },
];

Deno.test("story-verify: handles are cleaned, junk dropped (MESITA-4535)", () => {
  assertEquals(cleanHandle("@Orinoco.MX"), "orinoco.mx");
  assertEquals(cleanHandle("not a handle!"), null);
  assertEquals(cleanHandle(42), null);
});

Deno.test("story-verify: the narrow answer maps indexes back to places; unknown indexes are dropped", () => {
  const v = narrowVerdictFrom({
    looks_like_story: true,
    candidates: [{ index: 0, handle_visible: true, location_visible: false }, { index: 9, handle_visible: true, location_visible: true }],
    notes: "ok",
  }, CANDS);
  assertEquals(v.candidates, [{ place_id: CANDS[0].place_id, handle_visible: true, location_visible: false }]);
  assertEquals(narrowQuestion(CANDS).includes("1: handle (none); location names: Café Dos / Cafe Dos Roma"), true);
});

Deno.test("story-verify: the open answer keeps only clean handles and short names", () => {
  const v = openVerdictFrom({ looks_like_story: false, place_handles: ["@Orinoco", "bad handle"], location_names: [" Roma "], mentions_mesita: true, notes: "" });
  assertEquals(v.place_handles, ["orinoco"]);
  assertEquals(v.location_names, ["Roma"]);
  assertEquals(v.looks_like_story, false);
});

function reply(content: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content), refusal: null } }] }), {
    status,
    headers: { "x-request-id": "req_1" },
  });
}

Deno.test("story-verify: narrow first; open only when narrow finds nothing", async () => {
  const calls: string[] = [];
  const fetchImpl = ((_u: string, init: RequestInit) => {
    const name = JSON.parse(String(init.body)).response_format.json_schema.name;
    calls.push(name);
    return Promise.resolve(
      name === "story_narrow"
        ? reply({ looks_like_story: true, candidates: [{ index: 0, handle_visible: false, location_visible: false }], notes: "" })
        : reply({ looks_like_story: true, place_handles: ["orinoco"], location_names: [], mentions_mesita: true, notes: "" }),
    );
  }) as typeof fetch;
  const v = await verifyImage({ key: "k", model: "gpt-6-luna", imageDataUrl: "data:image/jpeg;base64,AA", fetchImpl }, CANDS);
  assertEquals(calls, ["story_narrow", "story_open"]);
  assertEquals(v.ok && v.verdict.mode, "open");
});

Deno.test("story-verify: a refusal is final; a 429 retries next tick; a bad JSON twice is final", async () => {
  const refuse = (() =>
    Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: null, refusal: "no" } }] }), { status: 200 }))) as typeof fetch;
  const r1 = await verifyImage({ key: "k", model: "m", imageDataUrl: "x", fetchImpl: refuse }, []);
  assertEquals(!r1.ok && r1.failure, { code: "model_refusal", final: true, requestId: null });
  const busy = (() => Promise.resolve(new Response("{}", { status: 429 }))) as typeof fetch;
  const r2 = await verifyImage({ key: "k", model: "m", imageDataUrl: "x", fetchImpl: busy }, []);
  assertEquals(!r2.ok && [r2.failure.code, r2.failure.final], ["model_http_429", false]);
  let n = 0;
  const junk = (() => {
    n++;
    return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 }));
  }) as typeof fetch;
  const r3 = await verifyImage({ key: "k", model: "m", imageDataUrl: "x", fetchImpl: junk }, []);
  assertEquals(!r3.ok && [r3.failure.code, r3.failure.final, n], ["model_schema_violation", true, 2]);
});

// The SQL twin public.instagram_handle_of_url is pinned to these same cases
// in tests/database/story_ai.test.sql.
Deno.test("instagramHandleOfUrl: the cases its SQL twin shares (MESITA-4535)", () => {
  assertEquals(instagramHandleOfUrl("https://www.instagram.com/Probe.One_/?hl=es"), "probe.one_");
  assertEquals(instagramHandleOfUrl("https://example.com/x"), null);
});
