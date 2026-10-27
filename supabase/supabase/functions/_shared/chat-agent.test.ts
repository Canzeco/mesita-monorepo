// The Chat Agent (MESITA-2339): intent in, pipelines out, never a source.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  type ChatIntent,
  type ChatPipelines,
  type ChatPlace,
  chatContextForModel,
  extractChatIntent,
  NO_INTENT,
  parseChatIntent,
  planChatTurn,
  runChatAgent,
} from "./chat-agent.ts";

const place = (id: string, why: ChatPlace["why"], over: Partial<ChatPlace> = {}): ChatPlace => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  address: "Centro",
  familyKeys: ["drinks"],
  rating: 4.6,
  reviewCount: 300,
  about: null,
  distanceKm: null,
  why,
  ...over,
});

function pipelines(over: Partial<ChatPipelines> = {}) {
  const calls: string[] = [];
  const p: ChatPipelines = {
    name: (n) => (calls.push(`name:${n}`), Promise.resolve([place("named", "name")])),
    area: (f) => (calls.push(`area:${f.join(",")}`), Promise.resolve([place("near", "area")])),
    deep: (t) => (calls.push(`deep:${t}`), Promise.resolve([place("fits", "deep")])),
    hasAnchor: true,
    ...over,
  };
  return { p, calls };
}

const intent = (over: Partial<ChatIntent>): ChatIntent => ({ ...NO_INTENT, ...over });

Deno.test("parseChatIntent keeps known families, trims text, and drops everything else", () => {
  assertEquals(
    parseChatIntent({ placeName: "  Strana ", families: ["drinks", "bogus", "drinks"], nearby: true, qualitative: "x" }),
    { placeName: "Strana", families: ["drinks"], nearby: true, qualitative: null },
  );
  assertEquals(parseChatIntent(null), NO_INTENT);
  assertEquals(parseChatIntent("nope"), NO_INTENT);
  assertEquals(parseChatIntent({ nearby: "yes" }).nearby, false);
});

Deno.test("plan: a name runs Name, families or near-me run Area, a quality runs Deep", () => {
  assertEquals(planChatTurn(intent({ placeName: "Strana" }), true), ["name"]);
  assertEquals(planChatTurn(intent({ families: ["tacos"] }), false), ["area"]);
  assertEquals(planChatTurn(intent({ nearby: true }), true), ["area"]);
  assertEquals(planChatTurn(intent({ qualitative: "quiet, first date" }), true), ["deep"]);
  assertEquals(
    planChatTurn(intent({ placeName: "Strana", families: ["drinks"], qualitative: "rooftop" }), true),
    ["name", "area", "deep"],
  );
});

Deno.test("plan: near-me without a location cannot run Area, so Deep answers", () => {
  assertEquals(planChatTurn(intent({ nearby: true }), false), ["deep"]);
  assertEquals(planChatTurn(NO_INTENT, true), ["deep"]);
});

Deno.test("the agent calls exactly the planned pipelines with the intent's arguments", async () => {
  const { p, calls } = pipelines();
  const out = await runChatAgent(
    "un bar tranquilo cerca, tipo Strana",
    () => Promise.resolve(intent({ placeName: "Strana", families: ["drinks"], qualitative: "tranquilo" })),
    p,
    12,
  );
  // Deep embeds the whole message, so the kind of place shapes its meaning.
  assertEquals(calls.sort(), ["area:drinks", "deep:un bar tranquilo cerca, tipo Strana", "name:Strana"]);
  assertEquals(out.invoked, ["name", "area", "deep"]);
  assertEquals(out.places.map((x) => x.id), ["named", "near", "fits"]);
});

Deno.test("Deep gets the guest's message when the intent carries no quality", async () => {
  const { p, calls } = pipelines();
  await runChatAgent("algo rico", () => Promise.resolve(NO_INTENT), p, 12);
  assertEquals(calls, ["deep:algo rico"]);
});

Deno.test("a failed intent read falls back to Deep on the message", async () => {
  const { p, calls } = pipelines();
  const out = await runChatAgent("algo rico", () => Promise.resolve(null), p, 12);
  assertEquals(calls, ["deep:algo rico"]);
  assertEquals(out.invoked, ["deep"]);
  const thrown = await runChatAgent("algo rico", () => Promise.reject(new Error("boom")), pipelines().p, 12);
  assertEquals(thrown.invoked, ["deep"]);
});

Deno.test("dedupe keeps the first pipeline's copy; a failing pipeline contributes nothing", async () => {
  const { p } = pipelines({
    name: () => Promise.resolve([place("same", "name")]),
    area: () => Promise.reject(new Error("down")),
    deep: () => Promise.resolve([place("same", "deep"), place("other", "deep")]),
  });
  const out = await runChatAgent(
    "q",
    () => Promise.resolve(intent({ placeName: "Same", families: ["drinks"], qualitative: "cozy" })),
    p,
    12,
  );
  assertEquals(out.places.map((x) => `${x.id}:${x.why}`), ["same:name", "other:deep"]);
});

Deno.test("at most the operator's Places handed to Chat reach the model", async () => {
  const many = Array.from({ length: 30 }, (_, i) => place(`p${i}`, "deep"));
  const { p } = pipelines({ deep: () => Promise.resolve(many) });
  const out = await runChatAgent("q", () => Promise.resolve(NO_INTENT), p, 5);
  assertEquals(out.places.length, 5);
});

Deno.test("the merge is round-robin, so the last pipeline is never the one cut", async () => {
  const three = (why: ChatPlace["why"]) => [1, 2, 3].map((i) => place(`${why}${i}`, why));
  const { p } = pipelines({
    name: () => Promise.resolve(three("name")),
    area: () => Promise.resolve(three("area")),
    deep: () => Promise.resolve(three("deep")),
  });
  const out = await runChatAgent(
    "q",
    () => Promise.resolve(intent({ placeName: "x", families: ["drinks"], qualitative: "y" })),
    p,
    3,
  );
  assertEquals(out.places.map((x) => x.id), ["name1", "area1", "deep1"]);
});

Deno.test("Deep obeys the Family gate when the guest asked for a kind of place", async () => {
  const { p } = pipelines({
    area: () => Promise.resolve([]),
    deep: () => Promise.resolve([place("cafe", "deep", { familyKeys: ["coffee"] }), place("roll", "deep", { familyKeys: ["sushi"] })]),
  });
  const out = await runChatAgent("sushi barato", () => Promise.resolve(intent({ families: ["sushi"], qualitative: "barato" })), p, 12);
  assertEquals(out.places.map((x) => x.id), ["roll"]);
});

Deno.test("a kept copy borrows the About a later pipeline's copy carries", async () => {
  const { p } = pipelines({
    name: () => Promise.resolve([place("same", "name", { about: null })]),
    deep: () => Promise.resolve([place("same", "deep", { about: "Live jazz." })]),
  });
  const out = await runChatAgent("q", () => Promise.resolve(intent({ placeName: "Same", qualitative: "jazz" })), p, 12);
  assertEquals(out.places.length, 1);
  assertEquals([out.places[0].why, out.places[0].about], ["name", "Live jazz."]);
});

Deno.test("the model's context groups places by why, and forbids inventing one", () => {
  const ctx = chatContextForModel([
    place("near", "area", { distanceKm: 1.2 }),
    place("named", "name"),
    place("fits", "deep", { about: "Live jazz on Thursdays." }),
  ], { hasAnchor: true });
  assert(ctx.includes("never invent one"));
  assert(ctx.indexOf("the Name pipeline") < ctx.indexOf("the Area pipeline"));
  assert(ctx.indexOf("the Area pipeline") < ctx.indexOf("the Deep pipeline"));
  assert(ctx.includes("1.2 km away"));
  assert(ctx.includes("Live jazz on Thursdays."));
  assertEquals(chatContextForModel([], { hasAnchor: true }), "");
  // Each place names its kind, so the model can check it fits.
  assert(ctx.includes("Bar"));
});

Deno.test("without a location, Area's places are never called 'around the guest'", () => {
  const ctx = chatContextForModel([place("far", "area")], { hasAnchor: false });
  assertEquals(ctx.includes("around the guest"), false);
  assert(ctx.includes("shared no location"));
});

Deno.test("extractChatIntent sends one structured-output call and validates the answer", async () => {
  const sent: Record<string, unknown>[] = [];
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return Promise.resolve(Response.json({
      choices: [{ message: { content: JSON.stringify({ placeName: null, families: ["sushi", "x"], nearby: true, qualitative: "barato" }) } }],
    }));
  }) as typeof fetch;
  const got = await extractChatIntent({ openaiKey: "k", model: "m", query: "sushi barato cerca", history: [], fetchImpl });
  assertEquals(got, { placeName: null, families: ["sushi"], nearby: true, qualitative: "barato" });
  assertEquals(sent.length, 1);
  const rf = sent[0].response_format as {
    type: string;
    json_schema: { strict: boolean; schema: { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> } };
  };
  assertEquals(rf.type, "json_schema");
  // Strict mode: every property required, nothing extra.
  assertEquals(rf.json_schema.strict, true);
  assertEquals(rf.json_schema.schema.additionalProperties, false);
  assertEquals([...rf.json_schema.schema.required].sort(), Object.keys(rf.json_schema.schema.properties).sort());
  assertEquals(await extractChatIntent({ openaiKey: "", model: "m", query: "q", history: [], fetchImpl }), null);
  const failing = (() => Promise.resolve(new Response("no", { status: 500 }))) as typeof fetch;
  assertEquals(await extractChatIntent({ openaiKey: "k", model: "m", query: "q", history: [], fetchImpl: failing }), null);
});

Deno.test("the Chat Agent module holds no database client and calls no source", async () => {
  const src = await Deno.readTextFile(new URL("./chat-agent.ts", import.meta.url));
  for (const banned of ["adminClient", ".from(", "searchNearbyPlaces", "fetchTextSearch", "fetchAutocomplete", "embedSingle"]) {
    assertEquals(src.includes(banned), false, banned);
  }
});
