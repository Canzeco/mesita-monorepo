"use client";

// Discovery: ONE page (MESITA-2327), five cards since MESITA-4454 (Pato:
// one formula, two lanes, three modes):
//
//   1. How places are ranked   read only: the formula and which screen
//                              reads which recipe row
//   2. Ranking                 the eight recipe rows → `params.recipes`
//   3. Mixing                  Home's shuffle, ads and variety →
//                              `params.mix`, `params.variety`,
//                              `map.catalogPageSize`
//   4. Map display             pins, dots, reload timing → four `map` keys
//   5. Searchbars              the Consumer and the Admin & Business boxes
//
// Each card saves only its own slices (BOX_SLICES, pinned by actions.test.ts),
// so two cards can never overwrite each other. Every save carries the stamp
// this page last saw (`DiscoverySaveScope`), so a stale page is refused with
// "Config changed, reload" instead of overwriting a newer save (H-3).
// Labels follow Pato's names: Half distance, Distance exponent, Stars
// exponent, Google exponent, Premier exponent, Temperature; never "root".

import { createContext, useContext, useState } from "react";
import { LayoutGrid, ListOrdered, MapPin, ScanSearch, Search, Shuffle } from "lucide-react";
import { NumberField, Notice, ReadField, SectionCard, SwitchRow } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import {
  CATALOG_PAGE_SIZE_MAX,
  CATALOG_PAGE_SIZE_MIN,
  isMapRow,
  isOrganicRow,
  MAP_DOTS_SHOWN_MAX,
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
  VARIETY_REPEAT_MAX,
  VARIETY_REPEAT_MIN,
  type DiscoveryConfig,
  type RankMode,
  type Recipe,
  type RecipeRow,
} from "./catalog";
import { HowItWorks, PipelineBox } from "./PipelineBox";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What each card's Save writes (actions.ts `DiscoverySlice`). Exported so
 *  actions.test.ts proves exactly these sets cannot reach each other. */
export const BOX_SLICES = {
  nameAdmin: ["nameAdmin"],
  name: ["nameDeep", "nameLocations", "nameIdle", "nameFloor"],
  ranking: ["ranking"],
  mixing: ["mixing"],
  mapDisplay: ["mapDisplay"],
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

/** The farthest an Inorganic place clears the ad floor: Proximity ×
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

const MODES: readonly { mode: RankMode | "map"; title: string; who: string }[] = [
  { mode: "nearby", title: "Nearby", who: "Home's Nearby chip." },
  { mode: "family", title: "Family", who: "Home's family chips. Chat ranks with Family Organic." },
  { mode: "popular", title: "Popular", who: "Home's Popular chip. The place screen's score uses Popular Organic." },
  { mode: "map", title: "Map", who: "The Search map. Popular and Family share these two rows; only the family filter differs." },
];

const rowOf = (mode: RankMode | "map", lane: "Organic" | "Inorganic") =>
  (mode === "map" ? `map${lane}` : `catalog${mode[0].toUpperCase()}${mode.slice(1)}${lane}`) as RecipeRow;

// 1 ─ How places are ranked ───────────────────────────────────────────────
export function HowRankedCard() {
  const uses: readonly [string, string][] = [
    ["Home › Nearby chip", "Nearby Organic + Nearby Inorganic"],
    ["Home › a family chip", "Family Organic + Family Inorganic"],
    ["Home › Popular chip", "Popular Organic + Popular Inorganic"],
    ["Chat", "Family Organic, inside its 15 km circle. No ads, no shuffle."],
    ["The place screen's score", "Popular Organic"],
    ["Search map", "Map Organic + Map Inorganic"],
    ["Pay, Wallet and the Reward tab", "Nearest first. No rows, no ads, no shuffle."],
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
          Score = Proximity × (stars ^ Stars exponent × reviews) ^ Google exponent × Premier ^ Premier exponent
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
            Every list has two lanes. <strong>Organic</strong>: every place, with Premier exponent 0, so a
            plan never moves it. <strong>Inorganic</strong>: Premier places only; they fill the ad slots and
            wear the &ldquo;Ad&rdquo; mark. The Mixing card says how the two lanes merge.
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

/** One recipe row: five label/value fields that wrap at phone width, then
 *  a helper line computed from the row's own numbers (M1, M3). */
function RecipeFields({
  row,
  recipe,
  adFloor,
  off,
  onChange,
}: {
  row: RecipeRow;
  recipe: Recipe;
  adFloor: number;
  off: boolean;
  onChange: (p: Partial<Recipe>) => void;
}) {
  const organic = isOrganicRow(row);
  const map = isMapRow(row);
  const num = (
    label: string,
    key: "halfKm" | "distanceExp" | "starsExp" | "googleExp" | "premierExp",
  ) => (
    <NumberField
      label={label}
      value={recipe[key] as number}
      min={RECIPE_BOUNDS[key].min}
      max={RECIPE_BOUNDS[key].max}
      decimals
      well={false}
      disabled={off}
      onChange={(v) => onChange({ [key]: v })}
    />
  );
  const dash = (label: string) => (
    <ReadField label={label} boxed>
      —
    </ReadField>
  );
  const h = recipe.halfKm;
  const e = recipe.distanceExp;
  const prox =
    h != null && e != null
      ? [0.5, 1, 2, 5].map((d) => `${d} km ${fmtProx(proximityAt(d, h, e))}`).join(" · ")
      : null;
  const ratio = Math.pow(2.5, recipe.premierExp / recipe.googleExp);
  return (
    <div className="border-border flex flex-col gap-3 border-t pt-3">
      <p className="text-sm">
        <span className="font-semibold">{organic ? "Organic" : "Inorganic"}</span>
        <span className="text-muted-foreground">
          {organic ? " · every place; a plan never moves it" : " · Premier places only; they fill the ad slots"}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {map ? dash("Half distance (km)") : num("Half distance (km)", "halfKm")}
        {map ? dash("Distance exponent") : num("Distance exponent", "distanceExp")}
        {num("Stars exponent", "starsExp")}
        {num("Google exponent", "googleExp")}
        {organic ? (
          <ReadField label="Premier exponent" boxed>
            0
          </ReadField>
        ) : (
          num("Premier exponent", "premierExp")
        )}
      </div>
      <Meta>
        {prox ? <>Proximity at {prox}.</> : <>No Proximity on the Map: the visible circle is the only cut.</>}
        {!organic ? (
          <>
            {" "}
            {map ? (
              <>No ad floor on the Map: an ad pin needs only to be on screen.</>
            ) : h != null && e != null ? (
              <>
                Ad reach at the saved ad floor {adFloor}: a 2X place up to {fmtKm(adReachKm(2, adFloor, h, e))},
                a 5X place up to {fmtKm(adReachKm(5, adFloor, h, e))}.
              </>
            ) : null}{" "}
            {recipe.premierExp > 0 ? (
              <>
                At the same distance and stars a 2X place passes a 5X place only with {timesFmt(ratio)} its
                reviews (2.5 ^ (Premier exponent ÷ Google exponent)).
              </>
            ) : (
              <>Premier exponent 0: 2X and 5X rank alike in this lane.</>
            )}
          </>
        ) : null}
      </Meta>
    </div>
  );
}

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
  // The ad reach reads the SAVED floor: an unsaved edit in Mixing does not move it.
  const adFloor = saved.params.mix.adFloor;
  return (
    <SectionCard
      id="s-ranking"
      icon={<LayoutGrid />}
      title="Ranking"
      subtitle="The numbers in the formula, one row per screen, mode and lane."
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-6">
        {MODES.map(({ mode, title, who }) => (
          <Group key={mode} title={title}>
            <Meta>{who}</Meta>
            {(["Organic", "Inorganic"] as const).map((lane) => {
              const row = rowOf(mode, lane);
              return (
                <RecipeFields
                  key={row}
                  row={row}
                  recipe={cfg.params.recipes[row]}
                  adFloor={adFloor}
                  off={off}
                  onChange={(p) => patch(row, p)}
                />
              );
            })}
          </Group>
        ))}
        <Meta>
          Half distance {RECIPE_BOUNDS.halfKm.min}–{RECIPE_BOUNDS.halfKm.max} km: about 0.5 km on foot, 2–3 km
          by car. Distance exponent: 1 is gentle, over 1 the list falls off past the Half distance. Stars
          exponent: how much stars count against reviews; 0 ignores stars. Google exponent: how far apart
          famous and unknown places sit; lower squeezes them together. Premier exponent: how much a plan
          counts in the ad lane.
        </Meta>
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
  const repeat = (v: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, variety: { repeat: v } } }));
  };
  const pageSize = (catalogPageSize: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, catalogPageSize } }));
  };
  const dirty =
    !same(mix, saved.params.mix) ||
    !same(cfg.params.variety, saved.params.variety) ||
    cfg.map.catalogPageSize !== saved.map.catalogPageSize;
  const r = cfg.params.variety.repeat;
  const T = MIX_BOUNDS.temperature;
  return (
    <SectionCard
      id="s-mixing"
      icon={<Shuffle />}
      title="Mixing"
      subtitle="How Home merges the two lanes and shuffles the first page. Home only: the Map and Chat are never shuffled."
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
            Only the first page is shuffled; everything after it keeps its exact order. 0 keeps the order
            exactly, 0.3 swaps neighbours, 1 is loose, 3 or more is almost random. Ads and organic places
            shuffle together. A guest sees the same order for the whole visit; a new visit, or moving more
            than 300 m, shuffles again.
          </Meta>
        </Group>
        <Group title="Ads">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Ad floor"
              value={mix.adFloor}
              min={MIX_BOUNDS.adFloor.min}
              max={MIX_BOUNDS.adFloor.max}
              decimals
              disabled={off}
              hint="Proximity × the plan's 2 or 5 must reach it. Uses the plan's 2 or 5, not the exponent."
              onChange={(adFloor) => patchMix({ adFloor })}
            />
            <NumberField
              label="Ad cadence"
              value={mix.adEvery}
              min={MIX_BOUNDS.adEvery.min}
              max={MIX_BOUNDS.adEvery.max}
              disabled={off}
              hint="One ad after every N organic places. 0 = no ads, on Home and on the Map."
              onChange={(adEvery) => patchMix({ adEvery })}
            />
          </div>
          <Meta>
            The merge: {mix.adEvery === 0 ? "no ad slots; the list is the Organic lane" : (
              <>
                {mix.adEvery === 1 ? "one organic place" : `${mix.adEvery} organic places`}, then one ad, again
                and again
              </>
            )}
            . A place already shown is skipped and its slot takes the next place of its lane. An ad slot with
            no Premier place left is dropped and the organic list continues. A place appears once, and wears
            &ldquo;Ad&rdquo; only when it sits in an ad slot. On Home a Premier place takes an ad slot only
            when its Proximity (from its mode&apos;s Inorganic row) × its plan&apos;s 2 or 5 reaches the ad floor;
            on the Map the screen is the cut, and ad pins count against Most pins shown.
          </Meta>
        </Group>
        <Group title="Variety and paging">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Repeat penalty"
              value={r}
              min={VARIETY_REPEAT_MIN}
              max={VARIETY_REPEAT_MAX}
              decimals
              disabled={off}
              onChange={repeat}
            />
            <NumberField
              label="Page size"
              value={cfg.map.catalogPageSize}
              min={CATALOG_PAGE_SIZE_MIN}
              max={CATALOG_PAGE_SIZE_MAX}
              disabled={off}
              onChange={pageSize}
            />
          </div>
          <Meta>
            Repeat penalty: each place has a kind, its rarest family (tacos, sushi, coffee…). In the Organic
            lane the second place of a kind is multiplied by {r}, the third by {Math.round(r * r * 100) / 100},
            so Home mixes kinds. Family and Popular only; Nearby never applies it. 1 turns it off.
          </Meta>
          <Meta>
            Page size: Home draws the list this many places at a time; it is also the shuffled first page.
          </Meta>
        </Group>
      </div>
      <Save editor={editor} dirty={dirty} slices={BOX_SLICES.mixing} />
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
            screen yet it uses 15 km. The best Most pins shown are full pins with a card in the carousel, ad
            pins included; the places after them, up to Most marks shown in all, are small dots with no card
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

// 5 ─ Searchbars: Admin & Business Searchbar Pipeline (unchanged) ─────────────
export function NameAdminBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const a = cfg.name.admin;
  const patch = (p: Partial<DiscoveryConfig["name"]["admin"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, name: { ...c.name, admin: { ...c.name.admin, ...p } } }));
  };
  const dirty = !same(cfg.name.admin, saved.name.admin);
  return (
    <PipelineBox
      id="s-name-admin"
      pipeline="name"
      title="Admin & Business Searchbar Pipeline"
      icon={<ScanSearch />}
      callers={["Admin Single Place › Find", "Business › Places"]}
      summary="Find a place by its name in Admin › Single Place, and when an owner claims their place. Google answers; admin sees Google's own order."
      explanation={
        <p>
          The Name pipeline as an admin runs it. An admin types a name and
          Google answers: Autocomplete runs through the guest bar&apos;s lane,
          with its rules, except the Minimum Popularity order: admin sees
          Google&apos;s own order. The Text Search column is Find&apos;s own
          call: it applies Mesita&apos;s place types but not Discovery ›
          General&apos;s active check. A Google hit Mesita holds shows as
          that Mesita place; a place neither returns is not found. Locations
          are never shown here. With the last option on, the page opens
          listing every Mesita place, as an empty search; Business › Places
          shows its first page, most reviewed first, before anything is
          typed. Business owners search through this pipeline when they
          claim their place (the Text Search column runs there too); a
          Google-only hit is added to Mesita when the owner taps Add and
          claim.
        </p>
      }
      scoring="Rows found by both sources come first, then Text Search rank, then Autocomplete rank. Duplicates merge."
      rules={[
        "Autocomplete rows follow the guest bar's rules: closed places never show, and a row must be one of Mesita's place types. The guest bar's Minimum Popularity order does not apply: admin sees Google's own order.",
        "Text Search rows are Find's own call: Mesita's place types and the old stored Google floors on rating, reviews and popularity (0 is off; no box edits them), not Discovery › General.",
      ]}
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.nameAdmin} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label="Max Autocomplete rows"
          value={a.autoCount}
          min={0}
          max={NAME_LANE_COUNT_MAX}
          disabled={off}
          onChange={(autoCount) => patch({ autoCount })}
        />
        <NumberField
          label="Max Text Search rows"
          value={a.textCount}
          min={1}
          max={NAME_ADMIN_TEXT_MAX}
          disabled={off}
          onChange={(textCount) => patch({ textCount })}
        />
        <SwitchRow
          label="Show results on an empty query"
          checked={a.emptyQuery}
          pending={off}
          onCheckedChange={(emptyQuery) => patch({ emptyQuery })}
        />
      </div>
      <p className="text-muted-foreground type-meta">
        0 Autocomplete rows means Find does not call Autocomplete.
      </p>
    </PipelineBox>
  );
}

// 5 ─ Searchbars: Consumer Searchbar Pipeline (unchanged) ─────────────────────
export function NameBox(seed: ConfigSeed<DiscoveryConfig>) {
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
  const dirty =
    !same(cfg.name.deep, saved.name.deep) ||
    cfg.name.locations !== saved.name.locations ||
    cfg.name.idleSec !== saved.name.idleSec ||
    cfg.name.popularityFloor !== saved.name.popularityFloor;
  // The floor is read at the Catalog's SAVED root (MESITA-3086): an unsaved
  // edit in the Catalog box does not change this readout.
  const floor = cfg.name.popularityFloor;
  const catalogRoot = saved.params.popularity.root;
  const floorReviews = Math.max(0, (Math.pow(floor, 1 / catalogRoot) - 1) / 4);
  return (
    <PipelineBox
      id="s-name"
      pipeline="name"
      title="Consumer Searchbar Pipeline"
      icon={<Search />}
      callers={["The guest's Search bar"]}
      summary="The guest types a place's name; Google Autocomplete and Text Search answer together. Google places under the Minimum Popularity sort last; nothing is removed."
      explanation={
        <p>
          The guest knows which place they want. The search runs once they
          stop typing for the seconds below; Google Autocomplete and Text
          Search run together and merge into one list with duplicates
          removed. A Google hit Mesita holds shows as that Mesita place; a
          place neither returns is not found. A Location (a city, a region)
          shows with a location icon, and picking one moves the map. Picking
          a place moves the map there and makes it the first card. Mesita
          never searches its own places by name: Google&apos;s name finds
          them, Mesita&apos;s name only labels them. The always-on rules below
          still hold:
          closed places never show and a row must be one of Mesita&apos;s
          place types. Google places under the Minimum Popularity below sort
          after the rest; none are removed. Locations never move.
        </p>
      }
      save={
        <Save editor={editor} dirty={dirty} slices={BOX_SLICES.name} />
      }
    >
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
      <p className="text-muted-foreground type-meta">
        0 rows turns a source off.
      </p>
      <p className="text-muted-foreground type-meta">
        {floor > 0 ? (
          <>
            Minimum Popularity: Google places whose Popularity, at the
            Catalog&apos;s root (now {catalogRoot}), is under {floor} sort after the
            rest on the guest Search bar; none are removed. {floor} ≈ 4★ ×{" "}
            {timesFmt(floorReviews).replace("×", "")} reviews at that root.
          </>
        ) : (
          <>Minimum Popularity: Off. The bar keeps Google&apos;s order.</>
        )}{" "}
        Home, the Map and Chat never hide a place for its Popularity. Effect
        shows only in guest Search results. {NAME_POPULARITY_FLOOR_MIN}–
        {NAME_POPULARITY_FLOOR_MAX}.
      </p>
    </PipelineBox>
  );
}
