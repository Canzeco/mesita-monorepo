"use client";

// Discovery: ONE page (MESITA-2327), five cards since MESITA-4454 (Pato:
// one formula, two lanes, three modes):
//
//   1. How places are ranked   read only: the formula and which screen
//                              reads which recipe row
//   2. Ranking                 the ten lane rows, each with its batch →
//                              `params.recipes` (MESITA-4517)
//   3. Mixing                  Home's shuffle and the Inorganic lane →
//                              `params.mix` (no page or feed size: the
//                              lanes' batches size each weave)
//   4. Map display             pins, dots, reload timing → four `map` keys
//   5. Searchbars              the guest bar and the Admin & Business bar,
//                              one card, one Save (MESITA-4463)
//
// Each card saves only its own slices (BOX_SLICES, pinned by actions.test.ts),
// so two cards can never overwrite each other. Every save carries the stamp
// this page last saw (`DiscoverySaveScope`), so a stale page is refused with
// "Config changed, reload" instead of overwriting a newer save (H-3).
// Labels follow Pato's names: Half distance, Distance exponent, Stars
// exponent, Google exponent, Premier exponent, Temperature; never "root".

import { createContext, useContext, useState } from "react";
import { LayoutGrid, ListOrdered, MapPin, Search, Shuffle, Users } from "lucide-react";
import {
  NumberCell,
  NumberField,
  Notice,
  SectionCard,
  SwitchRow,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import {
  isMapRow,
  isOrganicRow,
  MAP_DOTS_SHOWN_MAX,
  SOCIAL_LATEST_EVENTS_MAX,
  SOCIAL_LATEST_EVENTS_MIN,
  MAP_DOTS_SHOWN_MIN,
  MAP_PLACES_SHOWN_MAX,
  MAP_PLACES_SHOWN_MIN,
  MAP_RELOAD_IDLE_SEC_MAX,
  MAP_RELOAD_IDLE_SEC_MIN,
  MAP_RELOAD_MIN_VIEWPORT_PCT_MAX,
  MAP_RELOAD_MIN_VIEWPORT_PCT_MIN,
  MIX_BOUNDS,
  NAME_ADMIN_TEXT_MAX,
  NAME_IDLE_SEC_MAX,
  NAME_IDLE_SEC_MIN,
  NAME_LANE_COUNT_MAX,
  NAME_POPULARITY_FLOOR_MAX,
  NAME_POPULARITY_FLOOR_MIN,
  RECIPE_BOUNDS,
  type DiscoveryConfig,
  type RankMode,
  type Recipe,
  type RecipeRow,
} from "./catalog";
import { HowItWorks } from "./PipelineBox";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What each card's Save writes (actions.ts `DiscoverySlice`). Exported so
 *  actions.test.ts proves exactly these sets cannot reach each other. */
export const BOX_SLICES = {
  searchbars: ["nameDeep", "nameLocations", "nameIdle", "nameFloor", "nameAdmin"],
  ranking: ["ranking"],
  mixing: ["mixing"],
  mapDisplay: ["mapDisplay"],
  social: ["social"],
  // No box writes Premier's prices since MESITA-3828; the slice stays so
  // actions.test.ts keeps proving no other box can overwrite them.
  premier: ["premier"],
} as const satisfies Record<string, readonly DiscoverySlice[]>;

/** "12×", "1,250×", "≈9.8M×": a ratio, readable at any size. */
function timesFmt(x: number): string {
  if (!Number.isFinite(x) || x < 0) return "—";
  if (x >= 1_000_000) {
    return `≈${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(x)}×`;
  }
  return `${Math.round(x).toLocaleString("en-US")}×`;
}

// ── The page's stamp (H-3) ────────────────────────────────────────────────
//
// The `updatedAt` this page last saw, shared by every card: a card's save
// sends it as `expectedUpdatedAt` and a successful save or load moves it, so
// saving one card and then another on the same page never conflicts, while a
// save from another tab since makes the server answer "Config changed,
// reload".

type Stamp = { get: () => string | null; set: (updatedAt: string | null) => void };
const PageStamp = createContext<Stamp | null>(null);

export function DiscoverySaveScope({
  initialUpdatedAt,
  children,
}: {
  initialUpdatedAt: string | null;
  children: React.ReactNode;
}) {
  const [stamp] = useState<Stamp>(() => {
    let seen = initialUpdatedAt;
    return {
      get: () => seen,
      set: (updatedAt) => {
        seen = updatedAt;
      },
    };
  });
  return <PageStamp.Provider value={stamp}>{children}</PageStamp.Provider>;
}

function useDiscoveryEditor(seed: ConfigSeed<DiscoveryConfig>) {
  const stamp = useContext(PageStamp);
  const editor = useConfigEditor({
    ...seed,
    load: getDiscoveryConfig,
    onLoaded: (r) => {
      stamp?.set(r.updatedAt);
    },
  });
  return { ...editor, stamp };
}

type Editor = ReturnType<typeof useDiscoveryEditor>;

/** Save, its states (unsaved · saving · saved · save failed) and the last
 *  save's date. A refused save ("Config changed, reload", "Saved by an older
 *  server, retry") shows here and keeps the edits. */
function Save({ editor, dirty, slices }: { editor: Editor; dirty: boolean; slices: readonly DiscoverySlice[] }) {
  const { pending, ok, loadBlocked, error, updatedAt, saveWith, stamp } = editor;
  const save = () =>
    saveWith(async (c) => {
      const r = await updateDiscoveryConfig(c, [...slices], stamp ? stamp.get() : updatedAt);
      if (r.ok) stamp?.set(r.updatedAt);
      return r;
    });
  return (
    <>
      {updatedAt ? (
        <p className="text-muted-foreground mt-4 type-meta">Last saved {formatShortDate(updatedAt)}</p>
      ) : null}
      {dirty && !pending ? <p className="text-muted-foreground mt-4 type-meta">Unsaved changes</p> : null}
      {error && !loadBlocked ? <Notice className="mt-4">{error}</Notice> : null}
      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok && !dirty}
        onClick={save}
        loadError={loadBlocked ? error : null}
      />
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground type-eyebrow">{title}</p>
      {children}
    </div>
  );
}

const Meta = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground type-meta">{children}</p>
);

// ── The recipe arithmetic (M1, MESITA-4454) ───────────────────────────────
// Mirrors proximityFromDistance and clearsAdFloor in
// _shared/pipeline-signals.ts; the helper lines under each row are computed
// from that row's own numbers.

/** Proximity at d km: 1 ÷ (1 + (d ÷ Half distance)^Distance exponent). */
function proximityAt(d: number, halfKm: number, exp: number): number {
  return 1 / (1 + Math.pow(d / halfKm, exp));
}

/** The farthest an Inorganic place clears the Inorganic floor: Proximity ×
 *  premierFactor (the plan's raw 2 or 5, never the exponent) ≥ floor, so
 *  d = Half distance × (premierFactor ÷ floor − 1)^(1 ÷ Distance exponent).
 *  A floor of 0 lets every distance through. */
function adReachKm(premierFactor: number, floor: number, halfKm: number, exp: number): number {
  if (floor <= 0) return Infinity;
  const ratio = premierFactor / floor - 1;
  return ratio <= 0 ? 0 : halfKm * Math.pow(ratio, 1 / exp);
}

const fmtProx = (p: number) => (p >= 0.01 ? p.toFixed(2) : p.toPrecision(1));
const fmtKm = (km: number) =>
  !Number.isFinite(km) ? "any distance" : `${Number(km.toPrecision(2)).toLocaleString("en-US")} km`;

/** The Ranking table, one flat list (MESITA-4517). A Mode is what the guest
 *  picks (Nearby, Family, Popular); a Lane is one ranked row inside it:
 *  Nearby Lane (close), Popular Lane (well known), Local Favorites Lane (near
 *  AND popular). Every lane has an Organic and an Inorganic row. Names are
 *  labels only (MESITA-4557): the stored keys never change. */
const LANE_ROWS: readonly { row: RecipeRow; lane: string; mode: string }[] = [
  { row: "catalogNearbyOrganic", lane: "Nearby Lane", mode: "Nearby Mode" },
  { row: "catalogNearbyInorganic", lane: "Nearby Lane", mode: "Nearby Mode" },
  { row: "catalogNearbyBoth", lane: "Local Favorites Lane", mode: "Nearby Mode" },
  { row: "catalogNearbyBothInorganic", lane: "Local Favorites Lane", mode: "Nearby Mode" },
  { row: "catalogFamilyClose", lane: "Nearby Lane", mode: "Family Mode" },
  { row: "catalogFamilyCloseInorganic", lane: "Nearby Lane", mode: "Family Mode" },
  { row: "catalogFamilyWellKnown", lane: "Popular Lane", mode: "Family Mode" },
  { row: "catalogFamilyWellKnownInorganic", lane: "Popular Lane", mode: "Family Mode" },
  { row: "catalogFamilyBoth", lane: "Local Favorites Lane", mode: "Family Mode" },
  { row: "catalogFamilyBothInorganic", lane: "Local Favorites Lane", mode: "Family Mode" },
  { row: "catalogPopularOrganic", lane: "Popular Lane", mode: "Popular Mode" },
  { row: "catalogPopularInorganic", lane: "Popular Lane", mode: "Popular Mode" },
  { row: "catalogPopularBoth", lane: "Local Favorites Lane", mode: "Popular Mode" },
  { row: "catalogPopularBothInorganic", lane: "Local Favorites Lane", mode: "Popular Mode" },
  { row: "mapOrganic", lane: "Map Lane", mode: "Map" },
  { row: "mapInorganic", lane: "Map Lane", mode: "Map" },
];

/** The organic Local Favorites rows (MESITA-4674): nearest first, nothing
 *  else, so Batch is their only number. */
const isFavoritesRow = (row: RecipeRow) =>
  row === "catalogNearbyBoth" || row === "catalogFamilyBoth" || row === "catalogPopularBoth";

/** "Organic Nearby Lane" / "Inorganic Local Favorites Lane". */
const laneName = (row: RecipeRow, lane: string) => `${isOrganicRow(row) ? "Organic" : "Inorganic"} ${lane}`;

/** Under the name: the Mode and how close (½ at N km). */
function laneNote(row: RecipeRow, mode: string, recipe: Recipe): string {
  const parts = [mode];
  if (isFavoritesRow(row)) parts.push("nearest first");
  else if (recipe.halfKm != null) parts.push(`½ at ${recipe.halfKm} km`);
  else parts.push("no distance");
  if (!isOrganicRow(row)) parts.push("Premier only");
  return parts.join(" · ");
}

// 1 ─ How places are ranked ───────────────────────────────────────────────
export function HowRankedCard() {
  const uses: readonly [string, string][] = [
    ["Home › Nearby chip (Nearby Mode)", "Nearby Lane + Local Favorites Lane, each Organic and Inorganic"],
    ["Home › a family chip (Family Mode)", "Nearby Lane + Popular Lane + Local Favorites Lane of one family, each Organic and Inorganic"],
    ["Home › Popular chip (Popular Mode)", "Popular Lane + Local Favorites Lane, each Organic and Inorganic"],
    ["Chat", "Family Mode's Organic Popular Lane, inside its 15 km circle. No Inorganic lane, no shuffle."],
    ["The place screen's score", "Popular Organic"],
    ["Search map", "Map Organic + Map Inorganic"],
    ["Pay, Wallet and the Reward tab", "Nearest first. No rows, no Inorganic lane, no shuffle."],
  ];
  return (
    <SectionCard
      id="s-how"
      icon={<ListOrdered />}
      title="How places are ranked"
      subtitle="One formula for every list. Each screen reads its own row of numbers from the Ranking card."
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-4">
        <code className="bg-muted w-fit max-w-full rounded-md px-2 py-1 text-xs break-words whitespace-normal">
          Score = Premier ^ Premier exponent × (((1 − w) × stars × reviews + w × growth) ^ Google exponent × (1 + Foursquare factor × raw ^ Foursquare exponent)) × Proximity
        </code>
        <div className="text-foreground flex max-w-3xl flex-col gap-2 text-sm leading-relaxed">
          <p>
            Proximity = 1 ÷ (1 + (distance ÷ Half distance) ^ Distance exponent): 1 at the guest, ½ at the
            Half distance. With no location it counts as 1. The Map has no Proximity: the visible circle
            decides who is on it, never the order.
          </p>
          <p>
            Premier is the place&apos;s plan: 1 with no plan, 2 for 2X, 5 for 5X. The plan&apos;s weight in
            the score is Premier ^ Premier exponent.
          </p>
          <p>
            A <strong>feed</strong> is what the guest sees; a <strong>lane</strong> is one ranked row inside
            it, and every lane has an <strong>Organic</strong> row and an <strong>Inorganic</strong> row.
            A <strong>Mode</strong> is what the guest picks. Nearby Mode is the <strong>Nearby Lane</strong>{" "}
            (close) + the <strong>Local Favorites Lane</strong>; Popular Mode is the{" "}
            <strong>Popular Lane</strong> (well known) + the Local Favorites Lane, every family. Family Mode is
            one family in all three. The Local Favorites Lane is the places that are both near and popular:
            the better half of the Nearby ranking and the better half of the Popular ranking, nearest first and
            nothing else. Organic rows have Premier exponent 0, so a plan never
            moves them. Inorganic rows rank Premier places only; guests see them marked &ldquo;Ad&rdquo;.
          </p>
          <p>
            Each row gives its <strong>batch</strong> per weave. A weave takes the next batch of every organic
            lane, one from each in turn (both first), and puts one inorganic place after every cadence organic
            places, taken in turn from the feed&apos;s Inorganic rows, each up to its batch. A place appears once. Weaves repeat until the lanes run out; the first
            weave is Home&apos;s first screen. With every Family batch at 10 the three organic lanes give 30.
          </p>
          <p>
            w is the growth share. It is 0 until Fast Update has two snapshots at least 7 days apart in the
            last 90 days. Then w = 0.20 + 0.60 × min(observed days ÷ 30, 1): about 34% recent at 7 days and
            80% recent at 30 days, and it never goes higher. A place with no usable history scores
            (stars × reviews) ^ Google exponent. Growth is that place&apos;s new reviews per day, scaled to the
            local review base. A place we watched that did not gain reviews mixes in zero.
          </p>
          <p>
            Foursquare boost = 1 + Foursquare factor × raw ^ Foursquare exponent. It multiplies Google
            popularity after the Google exponent. Factor 1 allows up to 2×. A higher exponent concentrates
            that boost near the top of Foursquare&apos;s 0–1 scale. A missing score, or a measured 0, is 1×.
            Factor 0 turns the boost off.
          </p>
          <p>A place with no reviews or no stars scores 0 and ranks last; it is never hidden.</p>
        </div>
        <Group title="Which screen reads which row">
          <ul className="divide-border flex flex-col divide-y text-sm">
            {uses.map(([screen, row]) => (
              <li key={screen} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
                <span className="font-medium sm:w-56 sm:shrink-0">{screen}</span>
                <span className="text-muted-foreground">{row}</span>
              </li>
            ))}
          </ul>
        </Group>
      </div>
      <HowItWorks
        pipeline="catalog"
        summary="How Home and Chat rank, in full"
        explanation={
          <p>
            Home ranks every Mesita place for the guest&apos;s location in two lanes, merges them, then
            shuffles the first page a little. There is no radius: a far place is never cut, only lowered.
          </p>
        }
      />
      <HowItWorks
        pipeline="map"
        summary="How the Search map ranks, in full"
        explanation={
          <p>
            The Search tab&apos;s pins: every Mesita place inside the visible circle, ranked by the Map rows.
            Distance only decides who is on the map, never the order. Never shuffled.
          </p>
        }
      />
    </SectionCard>
  );
}

// 2 ─ Ranking ──────────────────────────────────────────────────────────────
//
// One table (MESITA-4463, Pato: "make ranking view a table"; design review
// 2026-11-19: 1A Effect column, 2A mode group rows, 3A kit NumberCell, 4A the
// Row column pinned and the rest scrolling inside the card on a phone).

type RecipeKey =
  | "halfKm"
  | "distanceExp"
  | "googleExp"
  | "foursquareFactor"
  | "foursquareExponent"
  | "premierExp"
  | "batch";

const RECIPE_COLUMNS: readonly { key: RecipeKey; label: string }[] = [
  { key: "batch", label: "Batch" },
  { key: "halfKm", label: "Half distance (km)" },
  { key: "distanceExp", label: "Distance exponent" },
  { key: "googleExp", label: "Google exponent" },
  { key: "foursquareFactor", label: "Foursquare factor" },
  { key: "foursquareExponent", label: "Foursquare exponent" },
  { key: "premierExp", label: "Premier exponent" },
];

/** What the row's numbers do, computed from the row as edited (1A). */
function recipeEffect(row: RecipeRow, recipe: Recipe, inorganicFloor: number): string {
  const organic = isOrganicRow(row);
  if (isFavoritesRow(row)) return "Order: nearest first";
  const h = recipe.halfKm;
  const e = recipe.distanceExp;
  if (h == null || e == null) return organic ? "No distance on the Map" : "Any Premier place on screen";
  if (organic) return `½ at ${h} km · 2 km ${fmtProx(proximityAt(2, h, e))}`;
  return `2X up to ${fmtKm(adReachKm(2, inorganicFloor, h, e))} · 5X up to ${fmtKm(adReachKm(5, inorganicFloor, h, e))}`;
}

/** A value the server forces: plain muted text, never an input (C1, L-1). */
const Fixed = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

export function RankingBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const patch = (row: RecipeRow, p: Partial<Recipe>) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      params: { ...c.params, recipes: { ...c.params.recipes, [row]: { ...c.params.recipes[row], ...p } } },
    }));
  };
  const dirty = !same(cfg.params.recipes, saved.params.recipes);
  // The inorganic reach reads the SAVED floor: an unsaved edit in Mixing does not move it.
  const inorganicFloor = saved.params.mix.adFloor;
  const cell = (row: RecipeRow, rowName: string, key: RecipeKey, label: string) => {
    const recipe = cfg.params.recipes[row];
    if (isMapRow(row) && (key === "halfKm" || key === "distanceExp" || key === "batch")) return <Fixed>—</Fixed>;
    if (isFavoritesRow(row) && key !== "batch") return <Fixed>—</Fixed>;
    if (isOrganicRow(row) && key === "premierExp") return <Fixed>0</Fixed>;
    return (
      <NumberCell
        ariaLabel={`${rowName}, ${label}`}
        value={recipe[key] as number}
        min={RECIPE_BOUNDS[key].min}
        max={RECIPE_BOUNDS[key].max}
        decimals
        disabled={off}
        onChange={(v) => patch(row, { [key]: v })}
        className="ml-auto"
      />
    );
  };
  return (
    <SectionCard
      id="s-ranking"
      icon={<LayoutGrid />}
      title="Ranking"
      subtitle="One row per lane: its batch and the numbers in its formula."
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-3">
        <Table>
          <THead>
            <Tr>
              <Th sticky>Row</Th>
              {RECIPE_COLUMNS.map(({ key, label }) => (
                <Th key={key} numeric className="align-bottom whitespace-normal">
                  <span className="block">{label}</span>
                  <span className="text-muted-foreground type-meta block font-normal tabular-nums">
                    {RECIPE_BOUNDS[key].min}–{RECIPE_BOUNDS[key].max}
                  </span>
                </Th>
              ))}
              <Th className="align-bottom">Effect</Th>
            </Tr>
          </THead>
          <TBody>
            {LANE_ROWS.map(({ row, lane, mode }) => (
              <Tr key={row}>
                <Td sticky className="font-medium">
                  {laneName(row, lane)}
                  <span className="text-muted-foreground type-meta block font-normal">
                    {laneNote(row, mode, cfg.params.recipes[row])}
                  </span>
                </Td>
                {RECIPE_COLUMNS.map(({ key, label }) => (
                  <Td key={key} numeric>
                    {cell(row, `${laneName(row, lane)}, ${mode}`, key, label)}
                  </Td>
                ))}
                <Td className="text-muted-foreground type-meta min-w-48 whitespace-normal">
                  {recipeEffect(row, cfg.params.recipes[row], inorganicFloor)}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        <Meta>
          Batch {RECIPE_BOUNDS.batch.min}–{RECIPE_BOUNDS.batch.max}: how many places the lane gives each
          weave; a lane with fewer left gives fewer, so a feed can be shorter than its batches add up to.
          The Map has no batch: Most pins shown cuts it. The Organic Local Favorites Lane is nearest first, so
          Batch is its only number. Half distance {RECIPE_BOUNDS.halfKm.min}–{RECIPE_BOUNDS.halfKm.max} km: about 0.5 km on foot, 2–3 km
          by car. Distance exponent: 1 is gentle, over 1 the list falls off past the Half distance. Google exponent: how far apart
          famous and unknown places sit; lower squeezes them together. Premier exponent: how much a plan
          counts in the Inorganic lane; at the same distance and stars a 2X place passes a 5X place only with
          2.5 ^ (Premier exponent ÷ Google exponent) times its reviews. Effect: Organic rows show where
          Proximity is ½ and its value at 2 km; Inorganic rows show how far a Premier place can be and still
          take an inorganic slot at the saved Inorganic floor ({inorganicFloor}).
        </Meta>
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          Foursquare factor 1 allows a boost of up to 2×. A higher Foursquare exponent concentrates that
          boost near the top of the 0–1 scale. A missing Foursquare score stays at 1×.
        </p>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.ranking} />
    </SectionCard>
  );
}

// 3 ─ Mixing ───────────────────────────────────────────────────────────────
export function MixingBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const mix = cfg.params.mix;
  const patchMix = (p: Partial<DiscoveryConfig["params"]["mix"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, mix: { ...c.params.mix, ...p } } }));
  };
  const temperature = (mode: RankMode, v: number) =>
    patchMix({ temperature: { ...mix.temperature, [mode]: v } });
  const dirty = !same(mix, saved.params.mix);
  const T = MIX_BOUNDS.temperature;
  return (
    <SectionCard
      id="s-mixing"
      icon={<Shuffle />}
      title="Mixing"
      subtitle="How Home weaves the lanes and shuffles the first weave. No page or feed size: each lane's batch sizes it. Home only: the Map and Chat are never shuffled."
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-6">
        <Group title="Temperature">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["nearby", "family", "popular"] as const).map((mode) => (
              <NumberField
                key={mode}
                label={mode === "nearby" ? "Nearby" : mode === "family" ? "Family" : "Popular"}
                value={mix.temperature[mode]}
                min={T.min}
                max={T.max}
                decimals
                disabled={off}
                onChange={(v) => temperature(mode, v)}
              />
            ))}
          </div>
          <Meta>
            Only the first weave is shuffled; everything after it keeps its exact order. 0 keeps the order
            exactly, 0.3 swaps neighbours, 1 is loose, 3 or more is almost random. Both lanes
            shuffle together. Every page load shuffles again (a reload draws a new feed), and so does moving
            more than 300 m; going back to a mode within one load keeps its order.
          </Meta>
        </Group>
        <Group title="Inorganic lane">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Inorganic floor"
              value={mix.adFloor}
              min={MIX_BOUNDS.adFloor.min}
              max={MIX_BOUNDS.adFloor.max}
              decimals
              disabled={off}
              hint="Proximity × the plan's 2 or 5 must reach it. Uses the plan's 2 or 5, not the exponent."
              onChange={(adFloor) => patchMix({ adFloor })}
            />
            <NumberField
              label="Inorganic cadence"
              value={mix.adEvery}
              min={MIX_BOUNDS.adEvery.min}
              max={MIX_BOUNDS.adEvery.max}
              disabled={off}
              hint="One inorganic place after every N organic places. 0 = the Organic lane alone, on Home and on the Map."
              onChange={(adEvery) => patchMix({ adEvery })}
            />
          </div>
          <Meta>
            The merge: {mix.adEvery === 0 ? "no inorganic slots; the list is the Organic lane" : (
              <>
                {mix.adEvery === 1 ? "one organic place" : `${mix.adEvery} organic places`}, then one inorganic place, again
                and again
              </>
            )}
            . A place already shown is skipped and its slot takes the next place of its lane. An inorganic slot
            with no Premier place left is dropped and the organic list continues. A place appears once; guests see it
            marked &ldquo;Ad&rdquo; only in an inorganic slot. On Home a Premier place takes an inorganic slot
            only when its Proximity (from its mode&apos;s Inorganic row) × its plan&apos;s 2 or 5 reaches the
            Inorganic floor; on the Map the screen is the cut, and inorganic pins count against Most pins shown.
          </Meta>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.mixing} />
    </SectionCard>
  );
}

// Social discovery ─────────────────────────────────────────────────────
// Home › Social (MESITA-4572, Pato: "display number of latest events. easy
// peasy. nothing else").
export function SocialDiscoveryBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const dirty = cfg.social.latestEvents !== saved.social.latestEvents;
  return (
    <SectionCard
      id="s-social"
      icon={<Users />}
      title="Social discovery"
      subtitle="Home › Social: everyone's newest events near the guest."
      className="scroll-mt-16"
    >
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Latest events shown"
          value={cfg.social.latestEvents}
          min={SOCIAL_LATEST_EVENTS_MIN}
          max={SOCIAL_LATEST_EVENTS_MAX}
          disabled={off}
          hint="How many of the newest events the Social feed shows, then it ends."
          onChange={(latestEvents) => {
            setOk(false);
            setCfg((c) => ({ ...c, social: { latestEvents } }));
          }}
        />
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.social} />
    </SectionCard>
  );
}

// 4 ─ Map display ──────────────────────────────────────────────────────────
const MAP_DISPLAY = ["placesShown", "dotsShown", "reloadIdleSec", "reloadMinViewportPct"] as const;

export function MapDisplayBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const map = (p: Partial<DiscoveryConfig["map"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };
  const dirty = MAP_DISPLAY.some((k) => cfg.map[k] !== saved.map[k]);
  return (
    <SectionCard
      id="s-map"
      icon={<MapPin />}
      title="Map display"
      subtitle="How many places the Search map marks, and when it reloads."
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-6">
        <Group title="Pins">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Most pins shown"
              value={cfg.map.placesShown}
              min={MAP_PLACES_SHOWN_MIN}
              max={MAP_PLACES_SHOWN_MAX}
              disabled={off}
              onChange={(placesShown) => map({ placesShown })}
            />
            <NumberField
              label="Most marks shown (pins + dots)"
              value={cfg.map.dotsShown}
              min={MAP_DOTS_SHOWN_MIN}
              max={MAP_DOTS_SHOWN_MAX}
              disabled={off}
              onChange={(dotsShown) => map({ dotsShown })}
            />
          </div>
          <Meta>
            The Map searches the visible circle (from the cross to the nearest edge of the map); with no
            screen yet it uses 15 km. The best Most pins shown are full pins with a card in the carousel,
            inorganic pins included; the places after them, up to Most marks shown in all, are small dots with no card
            that say &ldquo;zoom in here&rdquo;. At or under Most pins shown there are no dots.
          </Meta>
        </Group>
        <Group title="Reload">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Reload after the map rests (s)"
              value={cfg.map.reloadIdleSec}
              min={MAP_RELOAD_IDLE_SEC_MIN}
              max={MAP_RELOAD_IDLE_SEC_MAX}
              decimals
              disabled={off}
              onChange={(reloadIdleSec) => map({ reloadIdleSec })}
            />
            <NumberField
              label="Min map move to reload (% of screen)"
              value={cfg.map.reloadMinViewportPct}
              min={MAP_RELOAD_MIN_VIEWPORT_PCT_MIN}
              max={MAP_RELOAD_MIN_VIEWPORT_PCT_MAX}
              decimals
              disabled={off}
              onChange={(reloadMinViewportPct) => map({ reloadMinViewportPct })}
            />
          </div>
          <Meta>
            The Search map reloads when the guest stops moving it, at most once every this many seconds
            counted from the last reload, and only if the camera has moved at least this share of the screen
            since that reload (a pan or a zoom). 0% is any move. Finger-width pans do not refetch.
          </Meta>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.mapDisplay} />
    </SectionCard>
  );
}

// 5 ─ Searchbars: one card, two bars (MESITA-4463, Pato: "merge all searchbars
// into one box"). The guest's Search bar and the Admin & Business bar (admin
// Single Place › Find, Business › Places) share one Save that writes both
// Name slices and nothing else.
export function SearchbarsBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const name = (p: Partial<DiscoveryConfig["name"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, name: { ...c.name, ...p } }));
  };
  const deep = (p: Partial<DiscoveryConfig["name"]["deep"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, name: { ...c.name, deep: { ...c.name.deep, ...p } } }));
  };
  const admin = (p: Partial<DiscoveryConfig["name"]["admin"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, name: { ...c.name, admin: { ...c.name.admin, ...p } } }));
  };
  const a = cfg.name.admin;
  const dirty =
    !same(cfg.name.deep, saved.name.deep) ||
    !same(cfg.name.admin, saved.name.admin) ||
    cfg.name.locations !== saved.name.locations ||
    cfg.name.idleSec !== saved.name.idleSec ||
    cfg.name.popularityFloor !== saved.name.popularityFloor;
  // The floor is read at the SAVED Popularity exponent the Name pipeline still
  // uses (`params.popularity.root`, retired by MESITA-4457): an unsaved edit
  // elsewhere does not change this readout.
  const floor = cfg.name.popularityFloor;
  const floorExp = saved.params.popularity.root;
  const floorReviews = Math.max(0, (Math.pow(floor, 1 / floorExp) - 1) / 4);
  return (
    <SectionCard
      id="s-name"
      icon={<Search />}
      title="Searchbars"
      subtitle="Finding a place by its name. Google Autocomplete and Text Search answer; Mesita never searches its own places by name."
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-6">
        <Group title="Guest Search bar">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Seconds without typing before the search runs"
              value={cfg.name.idleSec}
              min={NAME_IDLE_SEC_MIN}
              max={NAME_IDLE_SEC_MAX}
              decimals
              disabled={off}
              onChange={(idleSec) => name({ idleSec })}
            />
            <NumberField
              label="Max Autocomplete rows"
              value={cfg.name.deep.autoCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={off}
              onChange={(autoCount) => deep({ autoCount })}
            />
            <NumberField
              label="Max Text Search rows"
              value={cfg.name.deep.googleCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={off}
              onChange={(googleCount) => deep({ googleCount })}
            />
            <SwitchRow
              label="Show Locations"
              checked={cfg.name.locations}
              pending={off}
              onCheckedChange={(locations) => name({ locations })}
            />
            <NumberField
              label="Minimum Popularity"
              value={cfg.name.popularityFloor}
              min={NAME_POPULARITY_FLOOR_MIN}
              max={NAME_POPULARITY_FLOOR_MAX}
              decimals
              disabled={off}
              onChange={(popularityFloor) => name({ popularityFloor })}
            />
          </div>
          <Meta>
            The guest types a place&apos;s name; Autocomplete and Text Search answer together, merged with
            duplicates removed. 0 rows turns a source off.{" "}
            {floor > 0 ? (
              <>
                Google places whose Popularity (at exponent {floorExp}) is under {floor} sort after the rest;
                none are removed. {floor} ≈ 4★ × {timesFmt(floorReviews).replace("×", "")} reviews.
              </>
            ) : (
              <>Minimum Popularity is off: the bar keeps Google&apos;s order.</>
            )}{" "}
            Home, the Map and Chat never hide a place for its Popularity.
          </Meta>
        </Group>
        <Group title="Admin & Business search">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Max Autocomplete rows"
              value={a.autoCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={off}
              onChange={(autoCount) => admin({ autoCount })}
            />
            <NumberField
              label="Max Text Search rows"
              value={a.textCount}
              min={1}
              max={NAME_ADMIN_TEXT_MAX}
              disabled={off}
              onChange={(textCount) => admin({ textCount })}
            />
            <SwitchRow
              label="Show results on an empty query"
              checked={a.emptyQuery}
              pending={off}
              onCheckedChange={(emptyQuery) => admin({ emptyQuery })}
            />
          </div>
          <Meta>
            Admin › Single Place › Find, and Business › Places when an owner claims their place. Google&apos;s
            own order: rows found by both sources first, then Text Search rank, then Autocomplete rank. No
            Minimum Popularity, no Locations. 0 Autocomplete rows means Find does not call Autocomplete.
          </Meta>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.searchbars} />
      <HowItWorks
        pipeline="name"
        summary="How the searchbars work, in full"
        explanation={
          <p>
            Both bars run the Name pipeline. A Google hit Mesita holds shows as that Mesita place; a place
            neither source returns is not found. Closed places never show and a row must be one of
            Mesita&apos;s place types. On the guest bar a Location (a city, a region) shows with a location
            icon and moves the map; picking a place moves the map there and makes it the first card. The
            admin bar&apos;s Text Search column is Find&apos;s own call: Mesita&apos;s place types, not
            Discovery&apos;s active check. With &ldquo;Show results on an empty query&rdquo; on, Find opens on
            every Mesita place and Business › Places shows its first page, most reviewed first; a Google-only
            hit is added to Mesita when the owner taps Add and claim.
          </p>
        }
      />
    </SectionCard>
  );
}
