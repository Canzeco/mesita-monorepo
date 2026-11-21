// The Story bot's eval (MESITA-4549): gates a change to the story prompt
// (STORY_VERIFY_PROMPT_V in _shared/story-verify.ts), the same way
// families-eval gates the families prompt.
//
//   cd supabase && OPENAI_KEY=… deno task story-eval [--model gpt-6-luna] [--bar 18]
//
// Reads cases.json beside this file: one case per image under images/, with
// the candidate handles the guest holds a voucher at and the decision the bot
// must reach ("matched:<handle>", "rejected", "ambiguous"). Prints one line
// per failing case (expected vs got) on stderr and exits 1 below the bar.
// No guest photos in git: cases are owner-made or synthetic, and consented
// real stories join from the first live ones (the plan's shadow start).

import { type Candidate, verifyImage } from "../../supabase/functions/_shared/story-verify.ts";

type Case = { image: string; candidates: string[]; expect: string };

const dir = new URL(".", import.meta.url).pathname;
const flag = (name: string) => {
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
};
const cases = JSON.parse(await Deno.readTextFile(`${dir}cases.json`)) as Case[];
if (cases.length === 0) {
  console.log("story-eval: no cases yet (cases.json is empty). Add owner-made or consented story images first.");
  Deno.exit(0);
}
const key = Deno.env.get("OPENAI_KEY")?.trim();
if (!key) {
  console.error("story-eval: set OPENAI_KEY in the environment");
  Deno.exit(2);
}
const model = flag("model") ?? "gpt-6-luna";
const bar = Number(flag("bar") ?? Math.ceil(cases.length * 0.9));

let pass = 0;
for (const c of cases) {
  const cands: Candidate[] = c.candidates.map((h, i) => ({ place_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, handle: h, name: null, google_name: null }));
  const bytes = await Deno.readFile(`${dir}images/${c.image}`);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const r = await verifyImage({ key, model, imageDataUrl: `data:image/jpeg;base64,${btoa(bin)}` }, cands);
  let got = "error";
  if (r.ok) {
    const v = r.verdict;
    if (!v.looks_like_story) got = "rejected";
    else if (v.mode === "narrow") {
      const seen = v.candidates.filter((x) => x.handle_visible || x.location_visible);
      got = seen.length === 1 ? `matched:${c.candidates[cands.findIndex((x) => x.place_id === seen[0].place_id)]}` : seen.length > 1 ? "ambiguous" : "rejected";
    } else {
      const hit = v.place_handles.filter((h) => c.candidates.includes(h));
      got = hit.length === 1 ? `matched:${hit[0]}` : hit.length > 1 ? "ambiguous" : "rejected";
    }
  }
  if (got === c.expect) pass++;
  else console.error(`FAIL ${c.image}: expected ${c.expect}, got ${got}`);
}
console.log(`story-eval: ${pass}/${cases.length} (bar ${bar}) model ${model}`);
Deno.exit(pass >= bar ? 0 : 1);
