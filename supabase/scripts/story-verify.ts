// The Story AI bot on one image (MESITA-4549, DX of MESITA-4535).
//
//   cd supabase && OPENAI_KEY=… deno task story-verify path/to/story.jpg [--candidates handle1,handle2] [--model gpt-6-luna]
//
// Runs the same code the cron runs (_shared/story-verify.ts verifyImage):
// the narrow question about the candidate handles first, then the open read.
// Prints the verdict JSON and what story_ai_verdict would decide for it.
// Nothing is written anywhere. The key comes from the environment and is
// never printed.

import { type Candidate, verifyImage } from "../supabase/functions/_shared/story-verify.ts";

const args = [...Deno.args];
const image = args.find((a) => !a.startsWith("--"));
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!image) {
  console.error("usage: deno task story-verify <image> [--candidates h1,h2] [--model name]");
  Deno.exit(2);
}
const key = Deno.env.get("OPENAI_KEY")?.trim();
if (!key) {
  console.error("story-verify: set OPENAI_KEY in the environment (the same key the Edge Functions use)");
  Deno.exit(2);
}
const model = flag("model") ?? "gpt-6-luna";
const handles = (flag("candidates") ?? "").split(",").map((h) => h.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
const cands: Candidate[] = handles.map((h, i) => ({ place_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, handle: h, name: null, google_name: null }));

const bytes = await Deno.readFile(image);
const mime = image.toLowerCase().endsWith(".png") ? "image/png" : image.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg";
let bin = "";
for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
const started = Date.now();
const r = await verifyImage({ key, model, imageDataUrl: `data:${mime};base64,${btoa(bin)}` }, cands);
const ms = Date.now() - started;

if (!r.ok) {
  console.log(JSON.stringify({ ok: false, failure: r.failure, ms }, null, 2));
  Deno.exit(1);
}
const v = r.verdict;
let decision: string;
if (!v.looks_like_story) decision = "rejected: not_a_story";
else if (v.mode === "narrow") {
  const seen = v.candidates.filter((c) => c.handle_visible || c.location_visible);
  decision = seen.length === 1 ? `matched: @${handles[cands.findIndex((c) => c.place_id === seen[0].place_id)]}` : seen.length > 1 ? "ambiguous" : "rejected: no_tag";
} else {
  decision = v.place_handles.length > 0 || v.location_names.length > 0
    ? `open read: SQL matches ${JSON.stringify(v.place_handles)} / ${JSON.stringify(v.location_names)} against places that sell Story`
    : "rejected: no_tag";
}
console.log(JSON.stringify({ ok: true, model, ms, verdict: v, decision }, null, 2));
