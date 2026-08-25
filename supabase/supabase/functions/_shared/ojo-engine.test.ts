// Unit tests for _shared/ojo-engine.ts (MESITA-1034). Network stubbed via
// globalThis.fetch; DB stubbed via a small per-table/per-select router —
// same idiom as ticket-check.test.ts's fakeAdmin, sized up because
// verifyProof reads three tables (visit_tickets, profiles, app_config twice
// under two different column selections) before writing one update back.
//
//   deno test --allow-env supabase/functions/_shared/ojo-engine.test.ts

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { verifyProof } from "./ojo-engine.ts";
import type { OjoConfig } from "./ojo-config.ts";

type Row = Record<string, unknown>;

const BASE_TICKET: Row = {
  id: "t1",
  place_id: "p1",
  status: "open",
  story_status: "self_verified",
  story_screenshot_url: "https://storage.example.com/ticket-proofs/c1/t1-story-1.jpg",
  story_ojo_attempts: 0,
  bill_subtotal_cents: 0,
  approved_at: null,
};

/**
 * A tiny fake single-row table, faithful enough to matter: update() is
 * FILTER-AWARE. The production CAS fix (the money-safety review's HIGH
 * finding) is exactly "the write only lands if fresh DB state still matches
 * the filters" — a mock that just records every update() call regardless of
 * its .eq()/.lte()/.is()/.in() predicates would pass every test whether or
 * not the CAS logic actually worked. So this mock tracks a live `row`
 * snapshot, evaluates each chained predicate against it, and only merges
 * the patch (and marks the entry `landed: true`) when every predicate is
 * still satisfied — the same thing Postgres's WHERE clause does.
 */
function makeAdmin(opts: {
  ticket?: Row | null;
  ojoConfig?: Partial<OjoConfig>;
  modelsConfig?: Record<string, unknown>;
  updateError?: string;
}) {
  const captured: { patch: Row; landed: boolean }[] = [];
  const row: Row = { ...(opts.ticket ?? BASE_TICKET) };
  const from = (table: string) => {
    let selectCols = "";
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select(cols: string) {
        selectCols = cols;
        return builder;
      },
      eq() {
        return builder;
      },
      maybeSingle() {
        if (table === "visit_tickets") {
          return Promise.resolve({ data: { ...row }, error: null });
        }
        if (table === "profiles") {
          return Promise.resolve({ data: { id: "p1", name: "Café Test" }, error: null });
        }
        if (table === "app_config") {
          if (selectCols.includes("ojo_config")) {
            return Promise.resolve({
              data: { ojo_config: opts.ojoConfig ?? {} },
              error: null,
            });
          }
          return Promise.resolve({
            data: { models_config: opts.modelsConfig ?? {} },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      update(patch: Row) {
        // Only visit_tickets is ever updated in production code; `matches`
        // starts true and any predicate below can flip it false.
        let matches = true;
        const predicates: (() => void)[] = [];
        // deno-lint-ignore no-explicit-any
        const updateChain: any = {
          eq: (col: string, val: unknown) => {
            if (col !== "id") predicates.push(() => { if (row[col] !== val) matches = false; });
            return updateChain;
          },
          lte: (col: string, val: number) => {
            predicates.push(() => { if (!((row[col] as number ?? 0) <= val)) matches = false; });
            return updateChain;
          },
          is: (col: string, val: null) => {
            predicates.push(() => { if (row[col] !== val) matches = false; });
            return updateChain;
          },
          in: (col: string, vals: unknown[]) => {
            predicates.push(() => { if (!vals.includes(row[col])) matches = false; });
            return updateChain;
          },
          then: (resolve: (v: unknown) => void) => {
            for (const p of predicates) p();
            const landed = matches && !opts.updateError;
            if (landed) Object.assign(row, patch);
            captured.push({ patch, landed });
            resolve({
              data: null,
              error: opts.updateError ? { message: opts.updateError } : null,
            });
          },
        };
        return updateChain;
      },
    };
    return builder;
  };
  return {
    admin: { from } as unknown as Parameters<typeof verifyProof>[0],
    captured,
    /** Exposed so a test can mutate DB state mid-flight (see the TOCTOU test). */
    row,
  };
}

// The model's wire shape is {confidence, reasons} ONLY — verdict is derived
// by deriveVerdict(), never sent by the model. See parseModelOutput.
function stubFetch(response: { confidence: number; reasons?: string[] } | "malformed" | "http_error") {
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    if (response === "http_error") {
      return Promise.resolve(new Response("rate limited", { status: 429 }));
    }
    const content = response === "malformed"
      ? "not json at all"
      : JSON.stringify(response);
    return Promise.resolve(
      new Response(
        JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function withEnv(fn: () => Promise<void>) {
  return async () => {
    Deno.env.set("OPENAI_KEY", "test-key");
    try {
      await fn();
    } finally {
      Deno.env.delete("OPENAI_KEY");
    }
  };
}

Deno.test(
  "verifyProof: disabled config is a no-op — never calls the model, never touches the ticket",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.9 });
    let fetchCalled = false;
    const real = globalThis.fetch;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      fetchCalled = true;
      return real(...args);
    }) as typeof fetch;
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: false } });
    const out = await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(out.ran, false);
    assertEquals(out.reason, "disabled");
    assertEquals(fetchCalled, false);
    assertEquals(captured.length, 0);
  }),
);

Deno.test(
  "verifyProof: no screenshot on the ticket is a no-op",
  withEnv(async () => {
    const { admin, captured } = makeAdmin({
      ticket: { ...BASE_TICKET, story_screenshot_url: null },
      ojoConfig: { enabled: true },
    });
    const out = await verifyProof(admin, "t1", "story");
    assertEquals(out.ran, false);
    assertEquals(out.reason, "no_screenshot");
    assertEquals(captured.length, 0);
  }),
);

Deno.test(
  "verifyProof: pass upgrades self_verified -> ai_verified, which isActionVerified() already counts as verified",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.92, reasons: ["clear IG story, place tagged"] });
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: true } });
    const out = await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(out.ran, true);
    assertEquals(out.result?.verdict, "pass");
    // Two writes: the unconditional annotation, then the CAS-guarded status
    // upgrade — see the "two updates, not one" note on verifyProof.
    assertEquals(captured.length, 2);
    assertEquals(captured[0].patch.story_ojo_verdict, "pass");
    assertEquals(captured[0].patch.story_ojo_attempts, 1);
    assertEquals(captured[0].landed, true);
    assertEquals(captured[1].patch.story_status, "ai_verified");
    assertEquals(captured[1].landed, true);
  }),
);

Deno.test(
  "verifyProof: pass never overwrites an already-terminal ai_rejected from a prior attempt (CAS-blocked, not just unrequested)",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.9 });
    const { admin, captured } = makeAdmin({
      ticket: { ...BASE_TICKET, story_status: "ai_rejected" },
      ojoConfig: { enabled: true },
    });
    await verifyProof(admin, "t1", "story");
    restore();
    // The upgrade IS attempted (production code has no in-memory pre-check
    // any more — the CAS filter is the only guard), but the fake DB's
    // .eq(statusCol, "self_verified") predicate correctly fails against the
    // real current value 'ai_rejected', so it must not land.
    assertEquals(captured[1].patch.story_status, "ai_verified");
    assertEquals(captured[1].landed, false);
  }),
);

Deno.test(
  "verifyProof: unsure persists the verdict but never touches status or money",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.55, reasons: ["hard to tell if this is the right place"] });
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: true } });
    const out = await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(out.result?.verdict, "unsure");
    assertEquals(captured.length, 1);
    assertEquals(captured[0].patch.story_ojo_verdict, "unsure");
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "story_status"), false);
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "fix_requested"), false);
  }),
);

Deno.test(
  "verifyProof: fail + failAction=flag (default) persists the verdict but the reward still stands",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.1, reasons: ["no rating visible"] });
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: true, failAction: "flag" } });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(captured.length, 1);
    assertEquals(captured[0].patch.story_ojo_verdict, "fail");
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "story_status"), false);
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "fix_requested"), false);
  }),
);

Deno.test(
  "verifyProof: fail + withhold, pre-bill, retries remaining -> reverts status and requests a fix through the EXISTING v4 loop",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.05, reasons: ["this is a screenshot of a text message"] });
    const { admin, captured } = makeAdmin({
      ojoConfig: { enabled: true, failAction: "withhold", maxRetries: 3, showGuestReason: true },
    });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(captured[1].landed, true);
    assertEquals(captured[1].patch.story_status, "ai_rejected");
    assertEquals(captured[1].patch.fix_requested, "proof");
    assertExists(captured[1].patch.fix_note);
  }),
);

Deno.test(
  "verifyProof: fail + withhold, showGuestReason=false -> generic fix_note, no model reasoning leaked",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.05, reasons: ["specific internal reasoning"] });
    const { admin, captured } = makeAdmin({
      ojoConfig: { enabled: true, failAction: "withhold", maxRetries: 3, showGuestReason: false },
    });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(
      (captured[1].patch.fix_note as string).includes("specific internal reasoning"),
      false,
    );
  }),
);

Deno.test(
  "verifyProof: fail + withhold, but a bill already exists -> the CAS write is attempted but never lands (money already shown is never touched)",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.05 });
    const { admin, captured } = makeAdmin({
      ticket: { ...BASE_TICKET, bill_subtotal_cents: 15000 },
      ojoConfig: { enabled: true, failAction: "withhold", maxRetries: 3 },
    });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(captured[0].patch.story_ojo_verdict, "fail");
    // withholdEligible() short-circuits before even attempting the write here
    // (bill_subtotal_cents > 0 fails the cheap in-memory pre-check), so
    // there's no second write at all — degrades to flag by never trying.
    assertEquals(captured.length, 1);
  }),
);

Deno.test(
  "verifyProof: fail + withhold, but the ticket is already approved -> degrades to flag, MESITA-1092's freeze holds",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.05 });
    const { admin, captured } = makeAdmin({
      ticket: { ...BASE_TICKET, approved_at: "2026-08-23T12:00:00Z" },
      ojoConfig: { enabled: true, failAction: "withhold", maxRetries: 3 },
    });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(captured.length, 1);
  }),
);

Deno.test(
  "verifyProof: the TOCTOU case — approval lands WHILE the vision call is in flight -> the CAS write is attempted (stale read still looked eligible) but does not land",
  withEnv(async () => {
    // This is the money-safety adversarial review's HIGH finding, reproduced:
    // verifyProof reads the ticket ONCE, then awaits the vision call (the
    // real 25s latency window), then decides/writes. Here the ticket is
    // open+unbilled at READ time (withholdEligible()'s cheap in-memory
    // pre-check passes on that stale snapshot) — but staff approve it WHILE
    // the vision call is in flight, simulated by mutating the fake DB's
    // live `row` from inside the fetch stub itself, exactly where that
    // latency window sits in the real code path. Without the CAS filters
    // added for this finding, the write below would have wrongly reverted
    // status on a ticket that is now approved and already priced.
    const { admin, captured, row } = makeAdmin({
      ticket: { ...BASE_TICKET },
      ojoConfig: { enabled: true, failAction: "withhold", maxRetries: 3 },
    });
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      row.approved_at = "2026-08-23T12:00:00Z"; // the race: approval lands mid-call
      const content = JSON.stringify({ confidence: 0.05 });
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
      );
    }) as typeof fetch;
    await verifyProof(admin, "t1", "story");
    globalThis.fetch = original;
    assertEquals(captured.length, 2, "the withhold write is attempted — the stale read still looked eligible");
    assertEquals(captured[1].patch.story_status, "ai_rejected");
    assertEquals(captured[1].landed, false, "the CAS filter must block a write against a ticket that moved to approved mid-flight");
  }),
);

Deno.test(
  "verifyProof: fail + withhold, but maxRetries already exhausted -> benefit of the doubt, degrades to flag",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.05 });
    const { admin, captured } = makeAdmin({
      ticket: { ...BASE_TICKET, story_ojo_attempts: 3 },
      ojoConfig: { enabled: true, failAction: "withhold", maxRetries: 3 },
    });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(captured.length, 1);
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "story_status"), false);
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "fix_requested"), false);
    // The attempt still counts, so a further retry doesn't reset the clock.
    assertEquals(captured[0].patch.story_ojo_attempts, 4);
  }),
);

Deno.test(
  "verifyProof: an HTTP error from the vision API fails OPEN — no write at all, no attempt burned",
  withEnv(async () => {
    const restore = stubFetch("http_error");
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: true } });
    const out = await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(out.ran, false);
    assertEquals(out.reason, "vision_call_failed");
    assertEquals(captured.length, 0);
  }),
);

Deno.test(
  "verifyProof: a malformed (non-JSON) model response fails OPEN the same way",
  withEnv(async () => {
    const restore = stubFetch("malformed");
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: true } });
    const out = await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(out.ran, false);
    assertEquals(captured.length, 0);
  }),
);

Deno.test(
  "verifyProof: missing OPENAI_KEY fails open before ever calling fetch",
  async () => {
    Deno.env.delete("OPENAI_KEY");
    let fetchCalled = false;
    const real = globalThis.fetch;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      fetchCalled = true;
      return real(...args);
    }) as typeof fetch;
    const { admin } = makeAdmin({ ojoConfig: { enabled: true } });
    const out = await verifyProof(admin, "t1", "story");
    globalThis.fetch = real;
    assertEquals(out.ran, false);
    assertEquals(out.reason, "no_openai_key");
    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "verifyProof: an out-of-range confidence from the model is clamped into [0, 1]",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 4.2 });
    const { admin, captured } = makeAdmin({ ojoConfig: { enabled: true } });
    await verifyProof(admin, "t1", "story");
    restore();
    assertEquals(captured[0].patch.story_ojo_confidence, 1);
  }),
);

Deno.test(
  "verifyProof: verdict is DERIVED from confidence against the admin's thresholds, never trusted from the model directly",
  withEnv(async () => {
    // A model returning a bare confidence with no categorical label at all
    // (the new wire shape — see buildPrompt/parseModelOutput) must still
    // derive a correct verdict from the admin's own autoPassScore/
    // reviewFloorScore, including CUSTOM (non-default) thresholds.
    const restore = stubFetch({ confidence: 0.6 });
    const { admin, captured } = makeAdmin({
      ojoConfig: { enabled: true, autoPassScore: 0.5, reviewFloorScore: 0.3 },
    });
    const out = await verifyProof(admin, "t1", "story");
    restore();
    // 0.6 >= autoPassScore(0.5) -> pass, even though it's well below the
    // DEFAULT 0.75 threshold — proves the config value is actually read.
    assertEquals(out.result?.verdict, "pass");
    assertEquals(captured[0].patch.story_ojo_verdict, "pass");
  }),
);

Deno.test(
  "verifyProof: the review kind reads/writes review_* columns, never story_*",
  withEnv(async () => {
    const restore = stubFetch({ confidence: 0.8 });
    const { admin, captured } = makeAdmin({
      ticket: {
        ...BASE_TICKET,
        review_status: "self_verified",
        review_screenshot_url: "https://storage.example.com/ticket-proofs/c1/t1-review-1.jpg",
        review_ojo_attempts: 0,
        story_screenshot_url: null,
      },
      ojoConfig: { enabled: true },
    });
    await verifyProof(admin, "t1", "review");
    restore();
    assertEquals(captured.length, 2);
    assertExists(captured[0].patch.review_ojo_verdict);
    assertEquals(Object.prototype.hasOwnProperty.call(captured[0].patch, "story_status"), false);
    assertEquals(captured[1].patch.review_status, "ai_verified");
    assertEquals(captured[1].landed, true);
    assertEquals(Object.prototype.hasOwnProperty.call(captured[1].patch, "story_status"), false);
  }),
);
