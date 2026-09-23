import type { WiredEngineKey } from "./catalog";

/**
 * The engine registry — Docs › Discovery §B, mirrored for the console.
 *
 * `wired` is the only thing that decides whether a row gets a control. An
 * engine that does not read the signal library must not offer a toggle over
 * it: the house rule is that a page whose engine is unbuilt shows its state,
 * not knobs.
 */
export const ENGINES: {
  key: string;
  label: string;
  fn: string;
  input: string;
  process: string;
  output: string;
  state: "LIVE" | "PARKED" | "UNBUILT";
  wired: WiredEngineKey | null;
  /** Vendor APIs this function calls when it runs. Empty = none. */
  apis: string[];
}[] = [
  {
    key: "swipe",
    label: "Swipe",
    fn: "swipe()",
    input: "Ready pool + guest geo.",
    process: "Live. Home's Scroll pill is the ranked deck. Places Lineup ranks under the Scroll mask, reading the Scroll column of the per-mode weights table. Admission stays radius, reviews, open+buffer, and type batteries. Slotting moves a promoting place into every Nth position after the blend.",
    output: "Ordered Home deck.",
    state: "LIVE",
    wired: "swipe",
    apis: [],
  },
  {
    key: "map",
    label: "Map",
    fn: "map()",
    input: "Ready pool + guest pin / Monterrey.",
    process: "Places scope picks one of THREE NESTED SETS (Pato, 2026-09-05) — Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner Places. ENRICHMENT GATES EVERY MESITA RING: a partner has to be enriched to sit inside the enriched one, so an unenriched partner is in neither ring and reads gray until it is enriched. A Created or Requested stub is never a search source. The guest picks the set by NAME on the wire (partners / mesita / google), never by an ordinal — mobile Search and the Pay place picker post no scope at all, so the absent value resolves to Mesita Enriched Places, the widest Mesita ring, never the narrowest. Closest N of the chosen set; a smaller membership paints, it does not add a pin. The two Mesita rings never call Nearby. Google is one Nearby Search among enabled categories, nearest N, and every gate on that call reads the lane cap, never the scope name. Max pins = that N, never the sum. N is the guest's How many on the Filters sheet — the console never asks for a count. Listed pins then Lineup, not distance. Google set stays distance. Pins, checked in that order: yellow = Mesita Partner Places (enriched AND the place PAYS), red = Mesita Enriched Places (we wrote a profile), gray = everything else — Google rows AND our own Created/Requested stubs, which have nothing to show. Red is earned by enrichment, and so is yellow. Blue is the guest's current location, never a place. Empty Nearby falls back to the Mesita set. Search auto-refetches after a reload pair (km AND sec). Rail or pin selection does not refetch.",
    output: "Pins and catalog rail.",
    state: "LIVE",
    wired: null,
    apis: ["Google Places Nearby Search"],
  },
  {
    key: "favorites",
    label: "Favorites",
    fn: "favorites()",
    input: "What this guest saved.",
    process: "Parked. Home is Soon. Recency of the save; no ranking. No pool gate — Mesita Listed Create stubs (not enriched) may be saved alongside Google and enriched rows.",
    output: "The saved list, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "catalog",
    label: "Catalog",
    fn: "catalog()",
    input: "Ready pool.",
    process: "Parked. Home is Soon. Rails stay on disk. Admin box is Soon; knobs persist on the blob.",
    output: "Stacked catalog rails, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "chat",
    label: "Chat",
    fn: "chat()",
    input: "The guest's utterance plus the thread the client resends.",
    process: "Parked. Home is Soon. OpenAI chat completions and the Discovery prompt stay on the blob.",
    output: "A conversational reply, when unparked.",
    state: "PARKED",
    wired: null,
    apis: ["OpenAI"],
  },
  {
    key: "social",
    label: "Social",
    fn: "social()",
    input: "Upcoming events at listed places (happenings, not places).",
    process: "Parked. Home is Soon. Admin box is Soon; knobs persist on the blob; no events engine yet. Will query events, not places.",
    output: "Event rails on Home › Social, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "name",
    label: "Name",
    fn: "name()",
    input: "A string + optional country + guest pin.",
    process: "Fast: Autocomplete only. Deep: four independent query caps, then concat. Autocomplete → Text Search → Mesita Places → Mesita Partners. Overlaps drop; first query keeps the slot. Caps are per query, not nested. Deep never calls Nearby Search. A Google hit that resolves to Mesita stays in its Google query. Places Lineup Name (`places.name`, not `google_name`). Map Filters never cut this list. Lineup Summary and the other Lineup signals are not a Deep input. Google types live on Search Sources.",
    output: "The right place.",
    state: "LIVE",
    wired: null,
    apis: ["Google Places Autocomplete", "Google Places Text Search", "Place Details"],
  },
  {
    key: "web",
    label: "Web",
    fn: "web()",
    input: "A query the catalog cannot answer.",
    process: "Unbuilt. Perplexity retrieval. Already called from Chat.",
    output: "Places the catalog lacks.",
    state: "UNBUILT",
    wired: null,
    apis: ["Perplexity"],
  },
];
