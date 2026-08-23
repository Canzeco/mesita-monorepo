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
// Docs › Enrichment §A. This mirrors §A2's stage table; if a function moves
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
      "The CREATE function — seed, the pulse gate and the Google spine run inline at the front door; the vector is queued (MESITA-1253).",
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
      "Writes the profile — functions 7 menu · 9 description, then persists data and images and vectorizes (semantic Summary).",
    tone: TONES.amber,
  },
};

// Every step_name the events table can carry, mapped to the stage that writes
// it. THREE families live here, and the third is the one a hand-written list
// forgets:
//
//   1. the NINE enrich functions and the two semantic ones (Docs › Enrichment
//      §A) — pulse/details/summary rows can ALSO come from the CREATE function
//      (meta.via === "create"), which the caller check below routes to its own
//      chip so an operator is not sent to read the research EF for a beacon
//      the front door wrote;
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
  // The CREATE function stamps pulse/details (and summary, via the embeddings
  // module) with meta.via === "create". Those rows must not wear a stage chip:
  // "Research" would send an operator to read the wrong Edge Function.
  if (meta.via === "create") return ENRICHER_PHASES.create;
  const stepName = typeof meta.stepName === "string" ? meta.stepName.trim() : "";
  const phase = PHASE_BY_STEP_NAME[stepName];
  return phase ? ENRICHER_PHASES[phase] : null;
}
