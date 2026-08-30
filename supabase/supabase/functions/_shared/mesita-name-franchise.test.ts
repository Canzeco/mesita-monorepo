// Source guard: the FRANCHISE RULE stays in BOTH Mesita Name prompts.
//
// The Description function owns the Mesita Name (Intake §A, function 4 on
// CREATE and function 9 on ENRICH), and it is inferred by a prompt — there is
// no deterministic code path a type error could protect. Two separate prompts
// write the same field:
//   * _shared/create-door-profile.ts  — the CREATE door, gate D1
//   * _shared/enrich-synthesis.ts     — ENRICH function 9
// A rule that lives only in prose is one careless prompt rewrite from being
// gone, and the loss is silent: the pipeline keeps running and every chain
// branch in the city quietly collapses back onto one name.
//
// THE RULE (Pato, 2026-08-29): a franchise/chain branch is named BRAND + WHERE
// IT IS — "Starbucks" in Polanco is "Starbucks Polanco", never bare
// "Starbucks". An independent one-location place is untouched. The qualifier
// is the place's own zone (colonia/neighborhood), city as the fallback, and
// both are passed in as signals so the model never invents a branch.

import { assertEquals } from "jsr:@std/assert@1";

const PROMPTS = [
  { file: "create-door-profile.ts", block: "Place block" },
  { file: "enrich-synthesis.ts", block: "LOCATION ANCHOR" },
] as const;

async function read(file: string): Promise<string> {
  return await Deno.readTextFile(new URL(file, import.meta.url));
}

Deno.test("both Mesita Name prompts carry the franchise rule", async () => {
  const missing: string[] = [];
  for (const { file } of PROMPTS) {
    const src = await read(file);
    if (!/FRANCHISE RULE/.test(src)) missing.push(`${file} — no FRANCHISE RULE`);
    // The worked example is the load-bearing half: models follow the sample.
    if (!/Starbucks Polanco/.test(src)) {
      missing.push(`${file} — no "Starbucks Polanco" worked example`);
    }
    // The other half of the rule: an independent place is left alone.
    if (!/INDEPENDENT/.test(src)) {
      missing.push(`${file} — no independent-place carve-out`);
    }
  }
  assertEquals(
    missing,
    [],
    "A chain branch's Mesita Name is BRAND + zone. Losing the rule from a " +
      "prompt makes every Starbucks in the city read the same, silently.\n" +
      missing.join("\n"),
  );
});

Deno.test("neither prompt still teaches the old strip-the-branch example", async () => {
  // The rule it replaced said "Tim Hortons TEC Campus" → "Tim Hortons", which
  // is exactly backwards for a franchise: the branch qualifier is the part
  // that makes the name usable.
  const offenders: string[] = [];
  for (const { file } of PROMPTS) {
    const src = await read(file);
    if (/Tim Hortons TEC Campus"?\s*(→|->)\s*"?Tim Hortons"/.test(src)) {
      offenders.push(`${file} — still strips the branch off a franchise name`);
    }
  }
  assertEquals(offenders, [], offenders.join("\n"));
});

Deno.test("both prompts are fed a zone/city anchor to qualify a branch with", async () => {
  // The rule forbids inventing a location, so the qualifier has to arrive as
  // a signal. If the plumbing goes, the model is told to append a zone it was
  // never given — and it will make one up.
  const door = await read("create-door-profile.ts");
  assertEquals(
    /zone\?: string \| null;/.test(door) &&
      /Neighborhood \/ zone: \$\{signals\.zone\}/.test(door),
    true,
    "create-door-profile.ts must accept zone/city and put them in the prompt",
  );

  const synth = await read("enrich-synthesis.ts");
  assertEquals(
    /zone\?: string \| null;/.test(synth) &&
      /LOCATION ANCHOR/.test(synth),
    true,
    "enrich-synthesis.ts must accept zone/city and put them in the prompt",
  );

  // …and the two callers must actually pass them.
  const create = await read("create-place.ts");
  assertEquals(
    /zone: \(place\.zone \?\? null\)/.test(create),
    true,
    "create-place.ts must pass the zone into the door",
  );
  const contents = await Deno.readTextFile(
    new URL("../supabase-cron-enrich-place-contents/index.ts", import.meta.url),
  );
  assertEquals(
    /zone: \(place\.zone \?\? null\)/.test(contents),
    true,
    "the contents stage must pass the zone into synthesis",
  );
});
