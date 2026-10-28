import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";
import { buildScoutInput, SCOUT_INSTRUCTIONS } from "./enrich-serp.ts";
import {
  contentStateAfterRefusal,
  ENRICHING_PATCH,
  enrichmentKnobs,
  enrichmentRun,
  renderApiKey,
  scoutInputFor,
  splitClaims,
  startEnrichment,
} from "./enrich-start.ts";

const ONE = { placeId: "place-1", googlePlaceId: "ChIJ-1" };
const TWO = { placeId: "place-2", googlePlaceId: "ChIJ-2" };

Deno.test("one place starts enrich single place with its Google id", () => {
  assertEquals(enrichmentRun([ONE]), {
    task: "mesita-monorepo/enrich-single-place",
    input: [ONE],
  });
});

Deno.test("enriching is the state alone, not a profile field", () => {
  assertEquals(ENRICHING_PATCH, { content_state: "generating" });
  assertEquals(Object.keys(ENRICHING_PATCH), ["content_state"]);
});

Deno.test("the Render key is the secret that exists", () => {
  const env = {
    get(name: string) {
      if (name === "RENDER_KEY") return " live-key ";
      if (name === "RENDER_API_KEY") return "old-key";
      return undefined;
    },
  };
  assertEquals(renderApiKey(env), "live-key");
  assertEquals(renderApiKey({ get: (name) => name === "RENDER_API_KEY" ? "old-key" : undefined }), "old-key");
  assertEquals(renderApiKey({ get: () => undefined }), "");
});

Deno.test("the Enrichment page rides on the job, with the Scout and Resolver texts the console shows", () => {
  const knobs = enrichmentKnobs({
    discoverCandidates: {
      website_url: 5,
      instagram_url: 7,
      facebook_url: 3,
      opentable_url: 3,
      uber_eats_url: 3,
    },
    perplexityPreset: "pro-search",
    visionQuality: "economy",
    synthesisQuality: "standard",
    gatherGoogleImages: 10,
    gatherInstagramDepth: 10,
    analyzeGoogleImages: 10,
    analyzeInstagramImages: 10,
    saveTotalImages: 10,
    visionEnabled: true,
    saveImagesToStorage: true,
    imageAnalysisPrompt: "describe the room",
    imageSortingPrompt: "best room first",
  });
  assertEquals(knobs.discoverInstagramN, 7);
  assertEquals(knobs.visionModel, "gpt-4o-mini");
  assertEquals(knobs.sortModel, "gpt-4o");
  assertEquals(knobs.resolverInstructions, RESOLVER_INSTRUCTIONS);
  assertEquals(knobs.scoutInstructions, SCOUT_INSTRUCTIONS);
  assertEquals(knobs.imageAnalysisPrompt, "describe the room");
});

Deno.test("the Scout's message is the console's builder over the saved place", () => {
  const saved = {
    name: "Contramar",
    google_name: "Contramar Roma",
    address: "Durango 200, Roma Nte., CDMX",
    category: "seafood_restaurant",
    category_label: "Seafood Restaurant",
  };
  assertEquals(
    scoutInputFor(saved),
    buildScoutInput({
      name: "Contramar",
      locationLine: "Durango 200, Roma Nte., CDMX",
      category: "Seafood Restaurant",
    }),
  );
});

Deno.test("the Scout's message falls back to the Google name and drops an undefined category", () => {
  assertEquals(
    scoutInputFor({ name: null, google_name: "Bar X", address: "", category: "undefined" }),
    buildScoutInput({ name: "Bar X", locationLine: "", category: null }),
  );
  assertEquals(scoutInputFor({ name: "", google_name: "" }), null);
});

Deno.test("a list starts enrich multiple places", () => {
  assertEquals(enrichmentRun([ONE, TWO]), {
    task: "mesita-monorepo/enrich-multiple-places",
    input: [[ONE, TWO]],
  });
});

Deno.test("a refused start turns enriching off: ready when enriched before, failed when never", () => {
  assertEquals(contentStateAfterRefusal({ content_state: "generating", enriched_at: "2026-10-01T00:00:00Z" }), "ready");
  assertEquals(contentStateAfterRefusal({ content_state: "generating", enriched_at: null }), "failed");
  assertEquals(contentStateAfterRefusal({ content_state: "ready", enriched_at: null }), null);
});

// A database of places where `enriching` names the ones a run already holds.
// The claim is `update places ... where content_state <> 'generating'`.
function fakeAdmin(enriching: Set<string>) {
  const writes: string[] = [];
  const client = {
    from(table: string) {
      const q = { table, op: "select", id: "", neq: "", ids: [] as string[] };
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: () => {
          q.op = "update";
          return builder;
        },
        in: (_col: string, ids: string[]) => {
          q.ids = ids;
          return builder;
        },
        eq: (col: string, value: string) => {
          if (col === "id") q.id = value;
          return builder;
        },
        neq: (_col: string, value: string) => {
          q.neq = value;
          return builder;
        },
        maybeSingle: () => Promise.resolve(resolve()),
        single: () => Promise.resolve(resolve()),
        then: (ok: (v: unknown) => unknown) => Promise.resolve(resolve()).then(ok),
      };
      const resolve = () => {
        if (table === "places" && q.op === "update") {
          if (q.neq === "generating" && enriching.has(q.id)) return { data: null, error: null };
          writes.push(q.id);
          enriching.add(q.id);
          return { data: { id: q.id }, error: null };
        }
        if (table === "place_profiles") {
          return {
            data: q.ids.map((id) => ({ id, google_place_id: `ChIJ-${id}`, name: id, updated_at: null })),
            error: null,
          };
        }
        return { data: null, error: null };
      };
      return builder;
    },
  };
  return { admin: client as unknown as SupabaseClient, writes };
}

const ENV = { get: (name: string) => (name === "RENDER_KEY" ? "key" : undefined) };

Deno.test("a second press on a place already enriching is refused before Render is paid", async () => {
  const { admin } = fakeAdmin(new Set(["place-1"]));
  let renderCalls = 0;
  const started = await startEnrichment(admin, {
    placeIds: ["place-1"],
    env: ENV,
    fetchImpl: () => {
      renderCalls++;
      return Promise.resolve(new Response("{}"));
    },
  });
  assertEquals(started, { ok: false, status: 409, error: "Already enriching.", blocked: "enriching" });
  assertEquals(renderCalls, 0);
});

Deno.test("a double press starts one run: the first claims, the second is refused", async () => {
  const { admin } = fakeAdmin(new Set());
  const bodies: unknown[] = [];
  const fetchImpl = (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response("{}"));
  };
  const first = await startEnrichment(admin, { placeIds: ["place-1"], env: ENV, fetchImpl: fetchImpl as typeof fetch });
  const second = await startEnrichment(admin, { placeIds: ["place-1"], env: ENV, fetchImpl: fetchImpl as typeof fetch });
  assertEquals(first.ok, true);
  assertEquals(second.ok ? null : second.status, 409);
  assertEquals(bodies.length, 1);
});

Deno.test("a list skips the places already enriching and starts the rest", async () => {
  const { admin, writes } = fakeAdmin(new Set(["place-2"]));
  const bodies: { input: unknown[] }[] = [];
  const started = await startEnrichment(admin, {
    placeIds: ["place-1", "place-2", "place-3"],
    env: ENV,
    fetchImpl: ((_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch,
  });
  assertEquals(started.ok && { started: started.started, skipped: started.skipped }, {
    started: ["place-1", "place-3"],
    skipped: ["place-2"],
  });
  assertEquals(writes, ["place-1", "place-3"]);
  const jobs = bodies[0].input[0] as { placeId: string }[];
  assertEquals(jobs.map((job) => job.placeId), ["place-1", "place-3"]);
});

Deno.test("splitClaims keeps the order the places were asked in", () => {
  assertEquals(splitClaims(["a", "b", "c"], [false, true, false]), { started: ["b"], skipped: ["a", "c"] });
});
