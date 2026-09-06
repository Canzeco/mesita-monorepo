// The console's prompt disclosure is only worth having if it cannot lie. These
// tests pin the two ways it could: a prompt going missing from the payload, and
// the payload drifting from the constants the pipeline actually sends.

import { assert, assertEquals } from "jsr:@std/assert@1";

import { intakePromptsMeta } from "./intake-prompts.ts";
import { SCOUT_INSTRUCTIONS } from "./enrich-serp.ts";
import { RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";
import { PRESENTATION_INSTRUCTIONS } from "./enrich-synthesis.ts";
import { CATEGORY_INSTRUCTIONS } from "./categories-infer.ts";
import { SUPER_CATEGORY_INSTRUCTIONS } from "./infer-super-categories.ts";

Deno.test("every prompt-bearing Intake step is on the payload, in pipeline order", () => {
  const keys = intakePromptsMeta().map((p) => p.key);
  assertEquals(keys, [
    "scout",
    "resolver",
    "category",
    "super_category",
    "presentation",
  ]);
});

Deno.test("the payload ships the SAME instructions the pipeline sends", () => {
  // The drift guard. `intake-prompts.ts` imports these constants rather than
  // restating them, so this can only fail if someone re-types a prompt into the
  // meta — which is exactly the mistake worth failing on.
  const byKey = new Map(intakePromptsMeta().map((p) => [p.key, p]));
  assertEquals(byKey.get("scout")!.instructions, SCOUT_INSTRUCTIONS);
  assertEquals(byKey.get("resolver")!.instructions, RESOLVER_INSTRUCTIONS);
  assertEquals(byKey.get("presentation")!.instructions, PRESENTATION_INSTRUCTIONS);
  assertEquals(byKey.get("category")!.instructions, CATEGORY_INSTRUCTIONS);
  assertEquals(byKey.get("super_category")!.instructions, SUPER_CATEGORY_INSTRUCTIONS);
});

Deno.test("the two named agents are Scout and Resolver, and nothing else is named", () => {
  const named = intakePromptsMeta()
    .filter((p) => p.agent)
    .map((p) => `${p.agent}@${p.fn}`);
  assertEquals(named, ["Scout@3 · Serp", "Resolver@4 · Links"]);
});

Deno.test("'Agent X' and 'Agent Y' are gone from every rendered string", () => {
  // The rename is only done if the placeholders cannot reach an operator's screen.
  for (const p of intakePromptsMeta()) {
    const blob = [p.label, p.vendor, p.vendorNote, p.writes, p.instructions, p.input]
      .join("\n");
    assert(!/Agent [XY]\b/.test(blob), `"Agent X/Y" still renders on ${p.key}`);
  }
});

Deno.test("every entry names its vendor and carries a non-empty prompt", () => {
  for (const p of intakePromptsMeta()) {
    assert(p.instructions.trim().length > 0, `${p.key} has empty instructions`);
    assert(p.input.trim().length > 0, `${p.key} has an empty input`);
    assert(p.vendor.trim().length > 0, `${p.key} names no vendor`);
    assert(p.writes.trim().length > 0, `${p.key} says nothing about what it writes`);
  }
});

Deno.test("Perplexity is named on both Perplexity steps, and on neither OpenAI one", () => {
  // Pato's ask: the console must SAY which vendor runs the step.
  const byKey = new Map(intakePromptsMeta().map((p) => [p.key, p]));
  const vendorOf = (k: string) => `${byKey.get(k)!.vendor} ${byKey.get(k)!.vendorNote}`;
  assert(vendorOf("scout").includes("Perplexity"));
  assert(vendorOf("resolver").includes("Perplexity"));
  assert(vendorOf("resolver").includes("Firecrawl"));
  assert(vendorOf("presentation").includes("OpenAI"));
  assert(!vendorOf("presentation").includes("Perplexity"));
  assert(vendorOf("category").includes("OpenAI"));
});

Deno.test("the rendered input is a TEMPLATE — sentinels, never a real place", () => {
  // Rendering with sentinels is what lets the console show the real builder's
  // output without a place in hand. If a builder stopped interpolating, the
  // placeholder would vanish and the disclosure would silently narrow.
  for (const p of intakePromptsMeta()) {
    assert(/\{[a-z_ ]+\}/i.test(p.input), `${p.key} rendered no placeholder`);
  }
});

Deno.test("the Resolver template renders every optional branch", () => {
  // The operator should read the FULLEST form of the message, not the degraded
  // one — a preview that hides the sibling/website/SERP blocks under-describes
  // what the vendor is actually sent on a normal run.
  const resolver = intakePromptsMeta().find((p) => p.key === "resolver")!;
  assert(resolver.input.includes("Already-known official channels"));
  assert(resolver.input.includes("Trust the links this official website itself lists"));
  assert(resolver.input.includes("Background on the place"));
  assert(resolver.input.includes("Candidate URLs found by search"));
  // Every channel field must be asked for by name.
  for (const f of ["website_url", "instagram_url", "facebook_url", "opentable_url", "uber_eats_url"]) {
    assert(resolver.input.includes(f), `${f} missing from the Resolver template`);
  }
});

Deno.test("the Images prompts are NOT duplicated here — they are editable elsewhere", () => {
  // They live on app_config and the console renders them as editable fields.
  // Listing them read-only too would state two truths about one prompt.
  const keys = intakePromptsMeta().map((p) => p.key);
  assert(!keys.includes("images"));
  assert(!keys.some((k) => k.includes("image")));
});
