"use client";

// Discovery: ONE page (MESITA-2327). Numbers first since MESITA-4694 (Pato:
// "make it cleaner … simpler"): every card shows its numbers, one short line
// of help per field, a status line and Save; anything longer sits in a closed
// "How it works" at the card's foot. In page order:
//
//   Ranking             the lane rows, each with its batch → `params.recipes`
//   Mixing              Home's shuffle and the Inorganic lane → `params.mix`
//   Social              Home › Social's length → `social`
//   Score overlay       Home's score numbers on the photos → `general.showScores`
//   Map                 pins, dots, reload timing → four `map` keys
//   Search bars         the guest bar and the Admin & Business bar, one Save
//   How ranking works   read only, closed: the formula and which screen
//                       reads which recipe row
//
// Each card saves only its own slices (BOX_SLICES, pinned by actions.test.ts),
// so two cards can never overwrite each other. Every save carries the stamp
// this page last saw (`DiscoverySaveScope`), so a stale page is refused with
// "Config changed, reload" instead of overwriting a newer save (H-3).
// Labels follow Pato's names: Half distance, Distance exponent, Stars
// exponent, Google exponent, Premier exponent, Temperature; never "root".

import { createContext, useContext, useEffect, useState } from "react";
import { Gauge, LayoutGrid, ListOrdered, MapPin, Search, Shuffle, Users } from "lucide-react";
import {
  Chip,
  Collapsible,
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
  offersOpen,
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
  scoreOverlay: ["scoreOverlay"],
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

type Stamp = {
  get: () => string | null;
  set: (updatedAt: string | null) => void;
  /** One save at a time, so each reads the stamp the one before it wrote. */
  queue: <T>(job: () => Promise<T>) => Promise<T>;
};
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
    let last: Promise<unknown> = Promise.resolve();
    return {
      get: () => seen,
      set: (updatedAt) => {
        seen = updatedAt;
      },
      queue: (job) => {
        const next = last.then(job);
        last = next.catch(() => undefined);
        return next;
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
    saveWith((c) => {
      const write = async () => {
        const r = await updateDiscoveryConfig(c, [...slices], stamp ? stamp.get() : updatedAt);
        if (r.ok) stamp?.set(r.updatedAt);
        return r;
      };
      return stamp ? stamp.queue(write) : write();
    });
  useUnsavedGuard(dirty);
  return (
    <>
      {/* One status line: unsaved, else when it was last saved. */}
      {dirty && !pending ? (
        <p className="text-muted-foreground mt-4 type-meta">Unsaved changes</p>
      ) : updatedAt ? (
        <p className="text-muted-foreground mt-4 type-meta">Last saved {formatShortDate(updatedAt)}</p>
      ) : null}
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

/** While a card has unsaved edits, the browser asks before the page is closed
 *  or reloaded (MESITA-4694): the jump row makes it easy to leave an edited
 *  card behind. Leaving by the sidebar is not guarded. */
function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const ask = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);
}

/** The card's `right` slot: "Unsaved" beside the title while it has edits, so
 *  it shows from the top of the card and when jumped to. */
const unsaved = (dirty: boolean) => (dirty ? <Chip>Unsaved</Chip> : undefined);

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
// Mirrors proximityFromDistance in _shared/pipeline-signals.ts; the helper lines under each row are computed
// from that row's own numbers.

/** Proximity at d km: 1 ÷ (1 + (d ÷ Half distance)^Distance exponent). */
function proximityAt(d: number, halfKm: number, exp: number): number {
  return 1 / (1 + Math.pow(d / halfKm, exp));
}

const fmtProx = (p: number) => (p >= 0.01 ? p.toFixed(2) : p.toPrecision(1));

/** The Ranking table (MESITA-5030). The first column is the lane. Names do
 *  not repeat "Lane". Map Nearby is Map Popular. Pay and Prepay are one
 *  lane each. Stored keys stay the old names where the lane is the same. */
const LANE_ROWS: readonly { row: RecipeRow; name: string; group: string }[] = [
  { row: "catalogNearbyOrganic", name: "Home Nearby Organic", group: "Home" },
  { row: "catalogNearbyInorganic", name: "Home Nearby Inorganic", group: "Home" },
  { row: "catalogPopularOrganic", name: "Home Popular Organic", group: "Home" },
  { row: "catalogPopularInorganic", name: "Home Popular Inorganic", group: "Home" },
  { row: "catalogFamilyClose", name: "Home Family Organic", group: "Home" },
  { row: "catalogFamilyCloseInorganic", name: "Home Family Inorganic", group: "Home" },
  { row: "mapOrganic", name: "Map Popular Organic", group: "Map" },
  { row: "mapInorganic", name: "Map Popular Inorganic", group: "Map" },
  { row: "mapFamilyOrganic", name: "Map Family Organic", group: "Map" },
  { row: "mapFamilyInorganic", name: "Map Family Inorganic", group: "Map" },
  { row: "pay", name: "Pay", group: "Pay" },
  { row: "prepay", name: "Prepay", group: "Prepay" },
];

/** Under the name: where it is used, and how close. */
function laneNote(row: RecipeRow, group: string, recipe: Recipe): string {
  const parts = [group];
  if (recipe.halfKm != null) parts.push(`½ at ${recipe.halfKm} km`);
  else parts.push("no distance");
  if (row.endsWith("Inorganic")) parts.push("Premier places");
  return parts.join(" · ");
}

// 1 ─ How places are ranked ───────────────────────────────────────────────
export function HowRankedCard() {
  const uses: readonly [string, string][] = [
    ["Home › Nearby", "Home Nearby Organic + Home Nearby Inorganic"],
    ["Home › Popular", "Home Popular Organic + Home Popular Inorganic"],
    ["Home › a family chip", "Home Family Organic + Home Family Inorganic, that family"],
    ["Chat", "Home Family Organic, inside its 15 km circle. No Inorganic lane, no shuffle."],
    ["The place screen's score", "Home Popular Organic"],
    ["Search map › Nearby or Popular", "Map Popular Organic + Map Popular Inorganic. Nearby is Popular."],
    ["Search map › a family chip", "Map Family Organic + Map Family Inorganic"],
    ["Pay", "The Pay row. The Pay list still orders by distance."],
    ["Prepay", "The Prepay row. The Prepay list still orders by distance."],
  ];
  return (
    <SectionCard
      id="s-how"
      icon={<ListOrdered />}
      title="How ranking works"
      subtitle="The formula, the words, and which screen reads which row."
      className="scroll-mt-20"
    >
      {/* Closed; the jump row opens it (`#s-how > details`). No id of its own. */}
      <Collapsible summary="Read it">
      <div className="flex flex-col gap-4">
        <code className="bg-muted w-fit max-w-full rounded-md px-2 py-1 text-xs break-words whitespace-normal">
          Score = Premier × Google × Foursquare × Offers × Proximity
        </code>
        <div className="text-foreground flex max-w-3xl flex-col gap-2 text-sm leading-relaxed">
          <p>
            Proximity = 1 ÷ (1 + (distance ÷ Half distance) ^ Distance exponent): 1 at the guest, ½ at the
            Half distance. With no location it counts as 1. The Map has no Proximity: the visible circle
            decides who is on it, never the order.
          </p>
          <p>
            Premier is the place&apos;s plan: 1 with no plan, Premier Pro and Premier Max from Mixing (2 and 5 by default). The plan&apos;s weight in
            the score is Premier ^ Premier exponent.
          </p>
          <p>
            Home has three chips. Each chip is one organic lane and one inorganic lane. Family is one
            list, not three. Local Favorites is gone. On the map, Nearby is a shortcut to Popular. A family
            chip on the map reads Map Family. Pay and Prepay are one lane each, with no organic split.
            Organic lanes keep Premier exponent 0, so a plan never moves them. Inorganic lanes rank Premier
            places only; guests see them marked &ldquo;Ad&rdquo;.
          </p>
          <p>
            Each Home lane gives its <strong>batch</strong> per weave. A weave takes that batch, then one
            inorganic place after every cadence organic places, up to the inorganic batch. A place appears
            once. The first weave is Home&apos;s first screen. The Map has no batch: Most pins shown cuts it.
          </p>
          <p>
            w is the growth share. It is 0 until Fast Update has two snapshots at least 7 days apart in the
            last 90 days. Then w = 0.20 + 0.60 × min(observed days ÷ 30, 1): about 34% recent at 7 days and
            80% recent at 30 days, and it never goes higher. A place with no usable history scores
            (stars × reviews) ^ Google exponent. Growth is that place&apos;s new reviews per day, scaled to the
            local review base. A place we watched that did not gain reviews mixes in zero.
          </p>
          <p>
            Foursquare = 1 + raw ^ Foursquare exponent. The factor is always 1, so the boost is at most 2×.
            A higher exponent concentrates it near the top of Foursquare&apos;s 0–1 scale. A missing score,
            or a measured 0, is 1×.
          </p>
          <p>
            Offers = offer points ^ Offers exponent. The points are the percents that place has on, added
            once: small, medium and big bonus, plus welcome, returning, welcome VIP and returning VIP.
            Discount and cashback are the same percent. Exponent 0 means the multiplier is 1. Exponent above
            0 and no points means the score is 0. Home and Map stay at 0 for now. Pay and Prepay edit it.
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
      </Collapsible>
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
  | "foursquareExponent"
  | "premierExp"
  | "offersExp"
  | "batch";

const RECIPE_COLUMNS: readonly { key: RecipeKey; label: string }[] = [
  { key: "batch", label: "Batch" },
  { key: "halfKm", label: "Half distance (km)" },
  { key: "distanceExp", label: "Distance exponent" },
  { key: "googleExp", label: "Google exponent" },
  { key: "foursquareExponent", label: "Foursquare exponent" },
  { key: "premierExp", label: "Premier exponent" },
  { key: "offersExp", label: "Offers exponent" },
];

/** What the row's numbers do, computed from the row as edited (1A). */
function recipeEffect(row: RecipeRow, recipe: Recipe): string {
  const h = recipe.halfKm;
  const e = recipe.distanceExp;
  if (h == null || e == null) {
    return isOrganicRow(row) ? "No distance on the Map" : "Any Premier place on screen";
  }
  return `½ at ${h} km · 2 km ${fmtProx(proximityAt(2, h, e))}`;
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
  const cell = (row: RecipeRow, rowName: string, key: RecipeKey, label: string) => {
    const recipe = cfg.params.recipes[row];
    if (isMapRow(row) && (key === "halfKm" || key === "distanceExp" || key === "batch")) return <Fixed>—</Fixed>;
    if (isOrganicRow(row) && key === "premierExp") return <Fixed>0</Fixed>;
    if (!offersOpen(row) && key === "offersExp") return <Fixed>0</Fixed>;
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
      subtitle="One lane, and the numbers in its score."
      right={unsaved(dirty)}
      className="scroll-mt-20"
    >
      <div className="mt-4 flex flex-col gap-3">
        <code className="bg-muted w-fit max-w-full rounded-md px-2 py-1 text-xs break-words whitespace-normal">
          Score = Premier × Google × Foursquare × Offers × Proximity
        </code>
        <Table>
          <THead>
            <Tr>
              <Th sticky>Lane</Th>
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
            {LANE_ROWS.map(({ row, name, group }) => (
              <Tr key={row}>
                <Td sticky className="font-medium">
                  {name}
                  <span className="text-muted-foreground type-meta block font-normal">
                    {laneNote(row, group, cfg.params.recipes[row])}
                  </span>
                </Td>
                {RECIPE_COLUMNS.map(({ key, label }) => (
                  <Td key={key} numeric>
                    {cell(row, name, key, label)}
                  </Td>
                ))}
                <Td className="text-muted-foreground type-meta min-w-48 whitespace-normal">
                  {recipeEffect(row, cfg.params.recipes[row])}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.ranking} />
      <Collapsible summary="How it works">
        <div className="flex flex-col gap-3">
        <Meta>
          Batch {RECIPE_BOUNDS.batch.min}–{RECIPE_BOUNDS.batch.max}: how many places the lane gives each
          weave. The Map leaves it blank: Most pins shown already cuts the map. Half distance{" "}
          {RECIPE_BOUNDS.halfKm.min}–{RECIPE_BOUNDS.halfKm.max} km, blank on the Map. Distance exponent{" "}
          {RECIPE_BOUNDS.distanceExp.min}–{RECIPE_BOUNDS.distanceExp.max}, blank on the Map. Google exponent{" "}
          {RECIPE_BOUNDS.googleExp.min}–{RECIPE_BOUNDS.googleExp.max}. Foursquare exponent{" "}
          {RECIPE_BOUNDS.foursquareExponent.min}–{RECIPE_BOUNDS.foursquareExponent.max}; the factor is always 1.
          Premier exponent {RECIPE_BOUNDS.premierExp.min}–{RECIPE_BOUNDS.premierExp.max}. Pro is 2 and Max is 5,
          set in Mixing. Organic lanes stay at 0. Offers exponent {RECIPE_BOUNDS.offersExp.min}–{RECIPE_BOUNDS.offersExp.max}.
          Home and Map stay at 0. Pay and Prepay edit it. Effect: where Proximity is ½, and its value at 2 km.
        </Meta>
        </div>
      </Collapsible>
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
      subtitle="How Home weaves the lanes and shuffles the first screen."
      right={unsaved(dirty)}
      className="scroll-mt-20"
    >
      <div className="mt-4 flex flex-col gap-6">
        <Group title="Temperature">
          <Meta>0 keeps the order; 1 is loose; 3 or more is near random.</Meta>
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
        </Group>
        <Group title="Inorganic lane">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Inorganic cadence"
              value={mix.adEvery}
              min={MIX_BOUNDS.adEvery.min}
              max={MIX_BOUNDS.adEvery.max}
              disabled={off}
              hint={
                mix.adEvery === 0
                  ? "No inorganic places."
                  : `${mix.adEvery === 1 ? "One organic place" : `${mix.adEvery} organic places`}, then one inorganic place, again and again.`
              }
              onChange={(adEvery) => patchMix({ adEvery })}
            />
          </div>
        </Group>
        <Group title="Premier plans">
          <Meta>What each paid plan multiplies a place&apos;s score by. A free place is 1.</Meta>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Premier Pro"
              value={mix.proFactor}
              min={MIX_BOUNDS.proFactor.min}
              max={MIX_BOUNDS.proFactor.max}
              decimals
              disabled={off}
              hint={`A Pro place counts ${mix.proFactor}× in the Inorganic lane. Default 2.`}
              onChange={(proFactor) => patchMix({ proFactor })}
            />
            <NumberField
              label="Premier Max"
              value={mix.maxFactor}
              min={MIX_BOUNDS.maxFactor.min}
              max={MIX_BOUNDS.maxFactor.max}
              decimals
              disabled={off}
              hint={`A Max place counts ${mix.maxFactor}× in the Inorganic lane. Default 5.`}
              onChange={(maxFactor) => patchMix({ maxFactor })}
            />
          </div>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.mixing} />
      <Collapsible summary="How it works">
        <div className="flex flex-col gap-3">
          <Meta>
            Only the first weave is shuffled; everything after it keeps its exact order. 0.3 swaps
            neighbours. Both lanes shuffle together. Every page load shuffles again (a reload draws a new
            feed), and so does moving more than 300 m; going back to a mode within one load keeps its order.
            No page or feed size: each lane&apos;s batch sizes it. Home only: the Map and Chat are never
            shuffled.
          </Meta>
          <Meta>
            At cadence 0
            the list is the Organic lane alone, on Home and on the Map. A place already shown is skipped and
            its slot takes the next place of its lane. An inorganic slot with no Premier place left is
            dropped and the organic list continues. A place appears once; guests see it marked
            &ldquo;Ad&rdquo; only in an inorganic slot. Every Premier place can take an inorganic slot; the
            nearest and most popular come first. On the Map the screen is the cut, and inorganic pins count
            against Most pins shown.
          </Meta>
        </div>
      </Collapsible>
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
      title="Social"
      subtitle="Home › Social: everyone's newest events near the guest."
      right={unsaved(dirty)}
      className="scroll-mt-20"
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

// Score overlay ────────────────────────────────────────────────────────
// Home's temporary score numbers on each row's photo (MESITA-4449), on or
// off (MESITA-4757, Pato: "toggle if show score data on top of images or if
// not show it"). Display only: no rank changes. A Save moves the config
// stamp, so Home drops its cached order and the next load reads it.
export function ScoreOverlayBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const dirty = cfg.general.showScores !== saved.general.showScores;
  return (
    <SectionCard
      id="s-scores"
      icon={<Gauge />}
      title="Score overlay"
      subtitle="Home: each place's score numbers on top of its photo."
      right={unsaved(dirty)}
      className="scroll-mt-20"
    >
      <div className="mt-4">
        <SwitchRow
          label="Show scores on photos"
          checked={cfg.general.showScores}
          pending={off}
          hint="Lane, Google, Foursquare, Popularity, Proximity, Premier and Final. Ranking does not change."
          onCheckedChange={(showScores) => {
            setOk(false);
            setCfg((c) => ({ ...c, general: { ...c.general, showScores } }));
          }}
        />
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.scoreOverlay} />
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
      title="Map"
      subtitle="How many places the Search map marks, and when it reloads."
      right={unsaved(dirty)}
      className="scroll-mt-20"
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
              hint="Full pins, each with a card."
              onChange={(placesShown) => map({ placesShown })}
            />
            <NumberField
              label="Most marks shown (pins + dots)"
              value={cfg.map.dotsShown}
              min={MAP_DOTS_SHOWN_MIN}
              max={MAP_DOTS_SHOWN_MAX}
              disabled={off}
              hint="Past the pins, places show as small dots with no card."
              onChange={(dotsShown) => map({ dotsShown })}
            />
          </div>
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
              hint="At most one reload in this many seconds."
              onChange={(reloadIdleSec) => map({ reloadIdleSec })}
            />
            <NumberField
              label="Min map move to reload (% of screen)"
              value={cfg.map.reloadMinViewportPct}
              min={MAP_RELOAD_MIN_VIEWPORT_PCT_MIN}
              max={MAP_RELOAD_MIN_VIEWPORT_PCT_MAX}
              decimals
              disabled={off}
              hint="0 = any move reloads."
              onChange={(reloadMinViewportPct) => map({ reloadMinViewportPct })}
            />
          </div>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.mapDisplay} />
      <Collapsible summary="How it works">
        <div className="flex flex-col gap-3">
          <Meta>
            The Map searches the visible circle (from the cross to the nearest edge of the map); with no
            screen yet it uses 15 km. The best Most pins shown are full pins with a card in the carousel,
            inorganic pins included; the places after them, up to Most marks shown in all, are small dots with no card
            that say &ldquo;zoom in here&rdquo;. At or under Most pins shown there are no dots.
          </Meta>
          <Meta>
            The Search map reloads when the guest stops moving it, at most once every this many seconds
            counted from the last reload, and only if the camera has moved at least this share of the screen
            since that reload (a pan or a zoom). 0% is any move. Finger-width pans do not refetch.
          </Meta>
        </div>
      </Collapsible>
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
  // The field's one line, computed from its current value.
  const floorHint =
    floor <= 0
      ? "Off: Google's order."
      : Math.round(floorReviews) < 1
        ? "Only places with no reviews sort last."
        : `Places under about ${timesFmt(floorReviews).replace("×", "")} reviews at 4★ sort last.`;
  return (
    <SectionCard
      id="s-name"
      icon={<Search />}
      title="Search bars"
      subtitle="Finding a place by its name, through Google."
      right={unsaved(dirty)}
      className="scroll-mt-20"
    >
      <div className="mt-4 flex flex-col gap-6">
        <Group title="Guest Search bar">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Wait before searching (s)"
              value={cfg.name.idleSec}
              min={NAME_IDLE_SEC_MIN}
              max={NAME_IDLE_SEC_MAX}
              decimals
              disabled={off}
              hint="Seconds without typing."
              onChange={(idleSec) => name({ idleSec })}
            />
            <NumberField
              label="Max Autocomplete rows"
              value={cfg.name.deep.autoCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={off}
              hint="0 turns Autocomplete off."
              onChange={(autoCount) => deep({ autoCount })}
            />
            <NumberField
              label="Max Text Search rows"
              value={cfg.name.deep.googleCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={off}
              hint="0 turns Text Search off."
              onChange={(googleCount) => deep({ googleCount })}
            />
            <SwitchRow
              label="Show Locations"
              checked={cfg.name.locations}
              pending={off}
              hint="Cities and regions in the results."
              onCheckedChange={(locations) => name({ locations })}
            />
            <NumberField
              label="Minimum Popularity"
              value={cfg.name.popularityFloor}
              min={NAME_POPULARITY_FLOOR_MIN}
              max={NAME_POPULARITY_FLOOR_MAX}
              decimals
              disabled={off}
              hint={floorHint}
              onChange={(popularityFloor) => name({ popularityFloor })}
            />
          </div>
        </Group>
        <Group title="Admin & Business search">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Max Autocomplete rows"
              value={a.autoCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={off}
              hint="0 turns Autocomplete off in Find."
              onChange={(autoCount) => admin({ autoCount })}
            />
            <NumberField
              label="Max Text Search rows"
              value={a.textCount}
              min={1}
              max={NAME_ADMIN_TEXT_MAX}
              disabled={off}
              hint="At least 1: Find always runs Text Search."
              onChange={(textCount) => admin({ textCount })}
            />
            <SwitchRow
              label="Show results on an empty query"
              checked={a.emptyQuery}
              pending={off}
              hint="On: Find opens on every Mesita place. Off: it waits for a query."
              onCheckedChange={(emptyQuery) => admin({ emptyQuery })}
            />
          </div>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.searchbars} />
      <HowItWorks
        pipeline="name"
        summary="How it works"
        explanation={
          <p>
            Google Autocomplete and Text Search answer; Mesita never searches its own places by name. On
            the guest bar the two answer together, merged with duplicates removed; Google places whose
            Popularity (at exponent {floorExp}) is under Minimum Popularity sort after the rest and none are
            removed. Home, the Map and Chat never hide a place for its Popularity. The Admin &amp; Business
            bar is Admin › Single Place › Find, and Business › Places when an owner claims their place: it
            keeps Google&apos;s own order (rows found by both sources first, then Text Search rank, then
            Autocomplete rank), with no Minimum Popularity and no Locations.{" "}
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
