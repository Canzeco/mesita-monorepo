// Families eval (MESITA-4238): does the careful family prompt pick right?
//
//   cd supabase && deno task families-eval
//
// Reads answer-key.json (40 live places, the labels two blind labellers agreed
// on, today's lists as the snapshot), asks admin-web-repick-families for each
// place's proposed families (dryRun, no writes) on both arms — `repick` (what
// rewrites live lists) and `enrich` (the Enrich families block) — twice each,
// and scores every run against the bar. Exits non-zero naming each miss.
// Writes the full result to result.json beside it. The service-role key is
// read from the Supabase CLI into this process and never printed.

import { placeFamilies } from "../../supabase/functions/_shared/sourcing.ts";
import { mainGoogleCategory } from "../../supabase/functions/_shared/families-infer.ts";

type KeyPlace = {
  place_id: string;
  google_place_id: string | null;
  name: string;
  google_types: string[];
  category: string | null;
  /** Families both labellers put on the place. */
  labels: string[];
  /** Families the labellers disagreed on: left out of scoring. */
  contested: string[];
  /** Today's stored list, before any re-pick. */
  snapshot: string[] | null;
  amenity_text: boolean;
};
type AnswerKey = { seed: string; created: string; places: KeyPlace[] };
type Proposal = { place_id: string; outcome: string; after: string[] | null };

const HERE = new URL(".", import.meta.url).pathname;
const CUISINE = [
  "tacos", "mexican", "sushi", "japanese", "italian", "pizza", "burgers", "seafood", "steak",
  "asian", "arabic", "european", "american", "chicken", "coffee", "breakfast",
];
const VENUE = new Set([
  "drinks", "night_out", "fun", "casino",
]);
const BAR = { familyFP: 2, drinksFP: 5, dinnerFP: 6, precision: 0.85, dinnerRecall: 0.8, drinksRecall: 0.8 };

async function serviceKey(ref: string): Promise<string> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const out = await new Deno.Command("supabase", {
      args: ["projects", "api-keys", "--project-ref", ref, "-o", "json"],
      stdout: "piped", stderr: "null",
    }).output();
    try {
      const rows = JSON.parse(new TextDecoder().decode(out.stdout)) as { name: string; api_key: string }[];
      const key = rows.find((r) => r.name === "service_role")?.api_key;
      if (key) return key;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  throw new Error("no service_role key from the Supabase CLI (is it logged in?)");
}

async function propose(base: string, key: string, arm: string, ids: string[]): Promise<Map<string, Proposal>> {
  const res = await fetch(`${base}/functions/v1/admin-web-repick-families`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Internal-Caller": "families-eval" },
    body: JSON.stringify({ dryRun: true, arm, place_ids: ids }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`EF ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return new Map((body.rows as Proposal[]).map((r) => [r.place_id, r]));
}

function score(places: KeyPlace[], picks: (p: KeyPlace) => string[] | null) {
  let tp = 0, fp = 0;
  const fpBy: Record<string, number> = {};
  const recallHit: Record<string, [number, number]> = {};
  for (const p of places) {
    const picked = new Set(picks(p) ?? []);
    const gold = new Set(p.labels);
    for (const f of picked) {
      if (p.contested.includes(f)) continue;
      if (gold.has(f)) tp++;
      else { fp++; fpBy[f] = (fpBy[f] ?? 0) + 1; }
    }
    for (const f of gold) {
      const r = (recallHit[f] ??= [0, 0]);
      r[1]++;
      if (picked.has(f)) r[0]++;
    }
  }
  const recall = (f: string) => (recallHit[f] ? recallHit[f][0] / recallHit[f][1] : 1);
  const cuisineRecall = (() => {
    let hit = 0, all = 0;
    for (const f of CUISINE) if (recallHit[f]) { hit += recallHit[f][0]; all += recallHit[f][1]; }
    return all ? hit / all : 1;
  })();
  return { tp, fp, precision: tp + fp ? tp / (tp + fp) : 1, fpBy, recallDinner: recall("dinner"), recallDrinks: recall("drinks"), cuisineRecall };
}

function misses(s: ReturnType<typeof score>, snapshotCuisine: number): string[] {
  const out: string[] = [];
  if ((s.fpBy.family ?? 0) > BAR.familyFP) out.push(`family false picks ${s.fpBy.family} > ${BAR.familyFP}`);
  if ((s.fpBy.drinks ?? 0) > BAR.drinksFP) out.push(`drinks false picks ${s.fpBy.drinks} > ${BAR.drinksFP}`);
  if ((s.fpBy.dinner ?? 0) > BAR.dinnerFP) out.push(`dinner false picks ${s.fpBy.dinner} > ${BAR.dinnerFP}`);
  if (s.precision < BAR.precision) out.push(`precision ${s.precision.toFixed(2)} < ${BAR.precision}`);
  if (s.recallDinner < BAR.dinnerRecall) out.push(`dinner recall ${s.recallDinner.toFixed(2)} < ${BAR.dinnerRecall}`);
  if (s.recallDrinks < BAR.drinksRecall) out.push(`drinks recall ${s.recallDrinks.toFixed(2)} < ${BAR.drinksRecall}`);
  if (s.cuisineRecall + 1e-9 < snapshotCuisine) out.push(`cuisine recall ${s.cuisineRecall.toFixed(2)} < snapshot ${snapshotCuisine.toFixed(2)}`);
  return out;
}

if (import.meta.main) {
  const key = JSON.parse(await Deno.readTextFile(`${HERE}answer-key.json`)) as AnswerKey;
  const ref = (await Deno.readTextFile(`${HERE}../../supabase/.temp/project-ref`)).trim();
  const base = `https://${ref}.supabase.co`;
  const sk = await serviceKey(ref);
  const ids = key.places.map((p) => p.place_id);

  const snap = score(key.places, (p) => p.snapshot);
  const result: Record<string, unknown> = { seed: key.seed, bar: BAR, snapshot: snap, runs: [] };
  const allMisses: string[] = [];
  for (const arm of ["repick", "enrich"]) {
    for (const round of [1, 2]) {
      const got = await propose(base, sk, arm, ids);
      const present = key.places.filter((p) => got.has(p.place_id));
      const s = score(present, (p) => got.get(p.place_id)?.after ?? null);
      const m = misses(s, snap.cuisineRecall);
      (result.runs as unknown[]).push({ arm, round, places: present.length, ...s, misses: m, proposals: Object.fromEntries(got) });
      allMisses.push(...m.map((x) => `${arm} #${round}: ${x}`));
      console.log(`${arm} #${round}: precision ${s.precision.toFixed(2)} · FP family ${s.fpBy.family ?? 0} drinks ${s.fpBy.drinks ?? 0} dinner ${s.fpBy.dinner ?? 0} · recall dinner ${s.recallDinner.toFixed(2)} drinks ${s.recallDrinks.toFixed(2)} cuisine ${s.cuisineRecall.toFixed(2)} (snapshot ${snap.cuisineRecall.toFixed(2)})${m.length ? "  MISS" : "  ok"}`);
    }
  }
  // uc1: what a "venue families need Google backing" rule would do to the first repick run.
  const first = (result.runs as { arm: string; proposals: Record<string, Proposal> }[])[0];
  let removedFalse = 0, removedTrue = 0;
  for (const p of key.places) {
    const after = first.proposals[p.place_id]?.after ?? [];
    const backed = new Set<string>(placeFamilies(mainGoogleCategory(p.google_types, p.category), p.google_types));
    for (const f of after) {
      if (!VENUE.has(f) || backed.has(f)) continue;
      if (p.labels.includes(f)) removedTrue++; else if (!p.contested.includes(f)) removedFalse++;
    }
  }
  result.uc1 = { removedFalsePicks: removedFalse, removedTruePicks: removedTrue };
  console.log(`uc1 (venue families need Google backing): would remove ${removedFalse} false picks and ${removedTrue} true picks`);
  await Deno.writeTextFile(`${HERE}result.json`, JSON.stringify(result, null, 2));
  if (allMisses.length) {
    console.error(`FAIL\n- ${allMisses.join("\n- ")}`);
    Deno.exit(1);
  }
  console.log("PASS — every arm and round meets the bar");
}
