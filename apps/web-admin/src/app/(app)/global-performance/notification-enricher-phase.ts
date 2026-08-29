import { TONES, type Tone } from "./notification-config";

// Which of the three cron EFs (supabase-cron-enrich-place-*) produced an
// enrichment event, for the Monitor's colour chip.
//
// IT MATCHES ON THE FUNCTION KEY, NEVER ON THE S-NUMBER (MESITA-1231).
//
// This used to bucket by number — `n <= 4` research, `n <= 6` analysis, `n <= 9`
// contents — which only worked while the ladder's numbering happened to be
// grouped by stage. It never really was: reviews has always been gathered by
// Research even though it sits late in the queue, because the Apify scrape
// fires into the background and is collected at the end. Under the ten-function
// ladder (MESITA-1243) the same arithmetic puts `social` (5) in Analysis and
// `reviews` (8) in Contents, both wrong, and drops the semantic Summary
// entirely because `SX` has no digits to parse.
//
// The key is the stable thing. Renumbering the ladder has never moved a key,
// which is exactly why the high-water reader matches on one — see
// Docs › Intake §A. This mirrors §A2's stage table; if a function moves
// between Edge Functions, it moves here too.
//
// Colors follow the catalog: Research≈Link=emerald, Analysis=sky,
// Contents/Persist=amber.
type EnricherPhase = {
  label: string;
  blurb: string;
  tone: Tone;
};

type PhaseKey = "create" | "research" | "analysis" | "contents";

const ENRICHER_PHASES: Record<PhaseKey, EnricherPhase> = {
  create: {
    label: "Create",
    blurb:
      "The CREATE function awaits five subfunctions — 1 Seed · 2 Pulse · 3 Details · 4 Description · 5 Embedding.",
    tone: TONES.emerald,
  },
  research: {
    label: "Research",
    blurb:
      "Gathers the raw material — functions 1 pulse · 2 details · 3 serp · 4 links · 5 social · 8 reviews.",
    tone: TONES.emerald,
  },
  analysis: {
    label: "Analysis",
    blurb:
      "Vision pass over candidate photos — function 6 images: describes each one, then ranks and selects the gallery.",
    tone: TONES.sky,
  },
  contents: {
    label: "Contents",
    blurb:
      "Writes the profile — functions 7 menu · 9 description, then persists data and images and ticks 10 Embedding.",
    tone: TONES.amber,
  },
};

// Every step_name the events table can carry, mapped to the stage that writes
// it. THREE families live here, and the third is the one a hand-written list
// forgets:
//
//   1. the TEN enrich functions 1–10 (Docs › Intake §A) —
//      pulse/details/description/embedding rows can ALSO come from the CREATE
//      function or an on-update re-embed. Function 10 was renamed `semantic` →
//      `embedding` (§8.4): the events table is append-only history, so BOTH
//      keys stay mapped — old rows keep their chip. Every embedding stamp
//      carries meta.via ("create" | "update" | "contents", set where the
//      vector write is observed in _shared/place-embeddings.ts), and create's
//      other subfunctions carry via: "create". The caller check below routes
//      create's rows to their own chip and update's to NO chip, so an
//      operator is never sent to read a stage EF for a beacon it did not
//      write;
//   2. the LEGACY STAGE BEACONS — gather · google_profile · analysis · publish
//      — which are not functions at all but do appear in the Monitor;
//   3. the TERMINAL BEACONS, `<stage>_crash` and `<stage>_cost_cap`, written by
//      serveEnrichStage in _shared/enrich-pipeline.ts rather than by any stage
//      body. Those are exactly the rows an operator opens the Monitor to find,
//      and the first version of this map omitted all six — the number-bucketing
//      it replaced had chipped them by accident, so dropping them was a quiet
//      regression. They are DERIVED from STAGE_KEYS below so a fourth stage
//      cannot silently repeat it.
//
// `seed` is absent because nothing stamps it: the row existing IS the seed.
const STAGE_KEYS = ["research", "analysis", "contents"] as const;

const PHASE_BY_STEP_NAME: Record<string, PhaseKey> = {
  // ── 1. the functions ──
  // Research
  pulse: "research",
  details: "research",
  serp: "research",
  links: "research",
  social: "research",
  reviews: "research",
  // Analysis
  images: "analysis",
  // Contents
  menu: "contents",
  description: "contents",
  summary: "contents",
  name: "contents",
  embedding: "contents",
  // Legacy key for function 10 (renamed `embedding`, §8.4) — history keeps it.
  semantic: "contents",

  // ── 2. the legacy stage beacons ──
  gather: "research",
  google_profile: "research",
  analysis: "analysis",
  publish: "contents",

  // ── 3. the terminal beacons ──
  ...Object.fromEntries(
    STAGE_KEYS.flatMap((stage) => [
      [`${stage}_crash`, stage],
      [`${stage}_cost_cap`, stage],
    ]),
  ),
};

/**
 * The stage behind one enrichment event, or null when we cannot say.
 *
 * NULL RATHER THAN A GUESS. An unrecognised step_name renders no phase chip at
 * all — the step chip beside it still shows the raw value. A wrong colour is
 * worse than a missing one: it tells an operator a confident lie about which
 * Edge Function to go read.
 */
export function enricherPhase(meta: Record<string, unknown>): EnricherPhase | null {
  // meta.via names the caller, stamped at the write. "create" wears the Create
  // chip — pulse/details/description from create-place.ts AND the embedding
  // the embeddings module stamps for it. "update" wears NO chip: an on-update
  // re-embed runs in-process in whatever EF edited the profile, and any stage
  // chip would be a lie (null rather than a guess — the step chip beside it
  // still names the function). "contents" and legacy via-less rows fall
  // through to the step_name map, where embedding (and the old rows' key,
  // semantic) → Contents is the truth.
  if (meta.via === "create") return ENRICHER_PHASES.create;
  if (meta.via === "update") return null;
  const stepName = typeof meta.stepName === "string" ? meta.stepName.trim() : "";
  const phase = PHASE_BY_STEP_NAME[stepName];
  return phase ? ENRICHER_PHASES[phase] : null;
}
