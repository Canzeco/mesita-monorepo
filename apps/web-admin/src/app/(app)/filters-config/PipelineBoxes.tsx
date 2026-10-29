"use client";

// Discovery: ONE page (MESITA-2327), five boxes, five pipelines (Pato,
// MESITA-2779, MESITA-2909): Admin Name · Consumer Name · Consumer Map ·
// Consumer Catalog · Consumer Deep. Each box is a PipelineBox and saves only
// its own slices, so two boxes can never overwrite each other. The Map and the
// Catalog were one Area pipeline until MESITA-2909; the Minimum Popularity
// they share sits in the Map box. Premier's factor is the paid tier, no knob
// (the Selected boost retired with Selected, MESITA-2925). The Chat Agent is
// Deep's caller, so its prompt sits in the Deep box.

import { AlertTriangle, LayoutGrid, MapPin, ScanSearch, Search, Sparkles } from "lucide-react";
import {
  NumberField,
  SaveRow,
  Switch,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import {
  BLUE_PER_RED_DEFAULT,
  BLUE_PER_RED_MAX,
  BLUE_PER_RED_MIN,
  CATALOG_PAGE_SIZE_MAX,
  CATALOG_PAGE_SIZE_MIN,
  HALF_KM_DEFAULT,
  HALF_KM_MAX,
  HALF_KM_MIN,
  MAP_PLACES_SHOWN_MAX,
  MAP_POPULARITY_FLOOR_MAX,
  MAP_POPULARITY_FLOOR_MIN,
  MAP_PLACES_SHOWN_MIN,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  MAP_RELOAD_IDLE_SEC_MAX,
  MAP_RELOAD_IDLE_SEC_MIN,
  MAP_RELOAD_MIN_VIEWPORT_PCT_MAX,
  MAP_RELOAD_MIN_VIEWPORT_PCT_MIN,
  NAME_ADMIN_TEXT_MAX,
  NAME_IDLE_SEC_MAX,
  NAME_IDLE_SEC_MIN,
  NAME_LANE_COUNT_MAX,
  type DiscoveryConfig,
} from "./catalog";
import { PipelineBox } from "./PipelineBox";

const ICON = "h-5 w-5";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What each box's Save writes (actions.ts `DiscoverySlice`). Exported so
 *  actions.test.ts proves exactly these sets cannot reach each other. */
export const BOX_SLICES = {
  nameAdmin: ["nameAdmin"],
  name: ["nameDeep", "nameLocations", "nameIdle"],
  map: ["mapPipeline"],
  catalog: ["catalogPipeline"],
} as const satisfies Record<string, readonly DiscoverySlice[]>;

function useDiscoveryEditor(seed: ConfigSeed<DiscoveryConfig>) {
  return useConfigEditor({ ...seed, load: getDiscoveryConfig });
}

type Editor = ReturnType<typeof useDiscoveryEditor>;

function Save({ editor, dirty, slices }: { editor: Editor; dirty: boolean; slices: readonly DiscoverySlice[] }) {
  const { pending, ok, loadBlocked, error, updatedAt, saveWith } = editor;
  return (
    <>
      {updatedAt ? (
        <p className="text-muted-foreground mt-4 type-meta">Last saved {formatShortDate(updatedAt)}</p>
      ) : null}
      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok && !dirty}
        onClick={() => saveWith((c) => updateDiscoveryConfig(c, [...slices]))}
        loadError={loadBlocked ? error : null}
      />
    </>
  );
}

function SwitchRow({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
      <span className="text-sm font-medium">{label}</span>
      <Switch on={on} pending={disabled} label={label} onClick={onClick} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

// 1 ─ Admin Name Pipeline ─────────────────────────────────────────────────
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
      title="Admin Name Pipeline"
      icon={<ScanSearch className={ICON} />}
      callers={["Admin Single Place › Find"]}
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
          listing every Mesita place, as an empty search.
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
          on={a.emptyQuery}
          disabled={off}
          onClick={() => patch({ emptyQuery: !a.emptyQuery })}
        />
      </div>
      <p className="text-muted-foreground type-meta">
        0 Autocomplete rows means Find does not call Autocomplete.
      </p>
    </PipelineBox>
  );
}

// 2 ─ Consumer Name Pipeline ───────────────────────────────────────────────
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
    cfg.name.idleSec !== saved.name.idleSec;
  return (
    <PipelineBox
      id="s-name"
      pipeline="name"
      title="Consumer Name Pipeline"
      icon={<Search className={ICON} />}
      callers={["The guest's Search bar"]}
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
          place types. Places under the Minimum Popularity (now{" "}
          {cfg.map.popularityFloor}, set in the Area box; 0 is off) sort after
          the rest; none are removed. Locations never move.
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
          on={cfg.name.locations}
          disabled={off}
          onClick={() => name({ locations: !cfg.name.locations })}
        />
      </div>
      <p className="text-muted-foreground type-meta">
        0 rows turns a source off.
      </p>
    </PipelineBox>
  );
}

// 3 ─ Consumer Map Pipeline ────────────────────────────────────────────────
export function MapBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const map = (p: Partial<DiscoveryConfig["map"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };
  // The Catalog box owns the page size.
  const mine = (m: DiscoveryConfig["map"]) => ({ ...m, catalogPageSize: 0 });
  const dirty = !same(mine(cfg.map), mine(saved.map));
  return (
    <PipelineBox
      id="s-map"
      pipeline="map"
      title="Consumer Map Pipeline"
      icon={<MapPin className={ICON} />}
      explanation={
        <>
          <p>
            The Search tab&apos;s pins: every Mesita place inside the
            <strong> screen radius</strong> (the distance from the cross to the
            nearest edge of the visible map), ranked by{" "}
            <strong>Popularity</strong> × the Premier factor.
          </p>
          <p className="mt-2">
            Distance only decides who is on the map, never the order: a place
            inside the circle ranks by how popular it is, however far from the
            cross. Mesita places only (no Google call).
          </p>
        </>
      }
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.map} />}
    >
      <Group title="Input">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Current-location radius (km)"
            value={cfg.map.radiusKm}
            min={MAP_RADIUS_KM_MIN}
            max={MAP_RADIUS_KM_MAX}
            decimals
            disabled={off}
            onChange={(radiusKm) => map({ radiusKm })}
          />
          <NumberField
            label="Most pins shown"
            value={cfg.map.placesShown}
            min={MAP_PLACES_SHOWN_MIN}
            max={MAP_PLACES_SHOWN_MAX}
            disabled={off}
            onChange={(placesShown) => map({ placesShown })}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          The Map uses the screen radius, and the current-location radius only
          when it has no screen to measure (no view yet, or one wider than
          100 km). It is also Chat&apos;s search radius.{" "}
          {MAP_RADIUS_KM_MIN}–{MAP_RADIUS_KM_MAX} km. The Map shows at most
          Most pins shown, best first. {MAP_PLACES_SHOWN_MIN}–{MAP_PLACES_SHOWN_MAX}.
        </p>
      </Group>
      <Group title="Signals">
        <div className="flex flex-col gap-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Minimum Popularity"
              value={cfg.map.popularityFloor}
              min={MAP_POPULARITY_FLOOR_MIN}
              max={MAP_POPULARITY_FLOOR_MAX}
              decimals
              disabled={off}
              onChange={(popularityFloor) => map({ popularityFloor })}
            />
          </div>
          <p className="text-muted-foreground type-meta">
            Minimum Popularity applies to the Map, the Catalog and Chat.
          </p>
        </div>
        <p className="text-muted-foreground type-meta">
          A place whose Popularity is under the Minimum Popularity (now{" "}
          {cfg.map.popularityFloor}; 0 is off) never shows on the Map, the
          Catalog or Chat, whatever its score: 3 is about 4★ × 5 reviews.
          On the guest Search bar it only reorders: Google places under it sort
          last, none are removed. Popularity is ln(1 + reviews × stars), never
          normalized: 4.6★ × 1,000 reviews ≈ 8.4, 4.0★ × 30 ≈ 4.8; a place with
          no Google numbers scores 0 and sinks, never disappears. A Premier
          place&apos;s score is multiplied by its paid tier (Premier 2X · 5X ·
          10X), every other place&apos;s by 1; being Premier never saves a place
          from the Minimum Popularity.
        </p>
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
        <p className="text-muted-foreground type-meta">
          The Search map reloads when the guest stops moving it, at most once
          every this many seconds counted from the last reload, and only if
          the camera has moved at least this share of the screen since that
          reload (a pan or a zoom). {MAP_RELOAD_IDLE_SEC_MIN}–{MAP_RELOAD_IDLE_SEC_MAX} s.
          {" "}
          {MAP_RELOAD_MIN_VIEWPORT_PCT_MIN}–{MAP_RELOAD_MIN_VIEWPORT_PCT_MAX}%
          of the last-reload view; 0 is any move. Finger-width pans do not
          refetch.
        </p>
      </Group>
    </PipelineBox>
  );
}

/** Proximity at d km with half distance D (km): the Catalog's curve,
 *  1 ÷ (1 + d ÷ D) (MESITA-3015). Mirrors proximityFromDistance. */
function catalogProximity(d: number, h: number): number {
  return 1 / (1 + d / h);
}

/** The sparkline's axis: Home's own scale, 0–10 km, never autoscaled
 *  (MESITA-3033): at D = 100 it reads flat, at D = 0.1 a cliff, by design. */
const CURVE_KM_MAX = 10;
const CURVE_TICKS_KM = [1, 5, 10] as const;
const CURVE_W = 200;
const CURVE_H = 48;

/** The half distance drawn: 1 ÷ (1 + d ÷ D) over 0–10 km, the ½ dot at
 *  (D, 0.5) when it fits the axis, the three tick labels the live values.
 *  `aria-hidden`: the field's hint is its text. Dims with the field. */
function CurveSparkline({ halfKm, off }: { halfKm: number; off: boolean }) {
  const x = (km: number) => (km / CURVE_KM_MAX) * CURVE_W;
  const y = (p: number) => 6 + (1 - p) * (CURVE_H - 20);
  const points = Array.from({ length: 41 }, (_, i) => {
    const km = (i / 40) * CURVE_KM_MAX;
    return `${x(km).toFixed(1)},${y(catalogProximity(km, halfKm)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
      className={`h-12 w-full ${off ? "opacity-50" : ""}`}
      aria-hidden="true"
      data-curve-sparkline
    >
      <line x1={0} y1={y(0)} x2={CURVE_W} y2={y(0)} className="stroke-border" strokeWidth={1} />
      <polyline points={points} fill="none" className="stroke-foreground" strokeWidth={1.5} />
      {CURVE_TICKS_KM.map((km) => (
        <text
          key={km}
          x={x(km)}
          y={CURVE_H - 2}
          textAnchor={km === CURVE_KM_MAX ? "end" : "middle"}
          className="fill-muted-foreground"
          fontSize={9}
        >
          {catalogProximity(km, halfKm).toFixed(2)} · {km} km
        </text>
      ))}
      {halfKm <= CURVE_KM_MAX ? (
        <>
          <circle cx={x(halfKm)} cy={y(0.5)} r={2.5} className="fill-foreground" />
          <text x={x(halfKm) + 4} y={y(0.5) - 3} className="fill-muted-foreground" fontSize={9}>
            ½
          </text>
        </>
      ) : null}
    </svg>
  );
}

/** Eight fixed slots filled by repeating the period 1 red + N grey
 *  (MESITA-3033). N ≤ 7, so the period always fits: every value draws its
 *  true pattern. At 0 all eight are grey and the words "Ads off" follow.
 *  Red is sponsored's colour everywhere in Mesita (the rosette, the pin). */
function LaneStrip({ bluePerRed, off }: { bluePerRed: number; off: boolean }) {
  const slots = Array.from({ length: 8 }, (_, i) => bluePerRed > 0 && i % (bluePerRed + 1) === 0);
  const label = bluePerRed === 0 ? "Ads off" : `1 ad, then ${bluePerRed} organic`;
  return (
    <div
      className={`flex items-center gap-1.5 ${off ? "opacity-50" : ""}`}
      role="img"
      aria-label={label}
      data-lane-strip
    >
      {slots.map((red, i) => (
        <span key={i} className={`size-2.5 rounded-full ${red ? "bg-destructive" : "bg-muted"}`} />
      ))}
      <span className="text-muted-foreground type-meta ml-1">
        {bluePerRed === 0 ? "Ads off" : "red = sponsored · grey = organic"}
      </span>
    </div>
  );
}

// 4 ─ Consumer Catalog Pipeline ────────────────────────────────────────────
export function CatalogBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const params = cfg.params;
  const proximity = (p: Partial<DiscoveryConfig["params"]["proximity"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, proximity: { ...c.params.proximity, ...p } } }));
  };
  const lanes = (bluePerRed: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, lanes: { bluePerRed } } }));
  };
  const pageSize = (catalogPageSize: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, catalogPageSize } }));
  };
  const dirty = cfg.map.catalogPageSize !== saved.map.catalogPageSize || !same(params, saved.params);
  const h = params.proximity.halfKm;
  const n = params.lanes.bluePerRed;
  // `!==` on numbers: a rounded -0 must never flicker the saved line.
  const hDirty = h !== saved.params.proximity.halfKm;
  const nDirty = n !== saved.params.lanes.bluePerRed;
  const turningAdsOff = n === 0 && saved.params.lanes.bluePerRed !== 0;
  return (
    <PipelineBox
      id="s-catalog"
      pipeline="catalog"
      title="Consumer Catalog Pipeline"
      icon={<LayoutGrid className={ICON} />}
      explanation={
        <>
          <p>
            Home&apos;s Places: <strong>every</strong> Mesita place, ranked in
            one run from the guest&apos;s device or saved pin, and drawn a page
            at a time. There is no radius: a far place is never cut, only
            lowered. No location: Popularity alone. Mesita places only (no
            Google call); the Map and Chat stay one list each.
          </p>
          {/* Rendered from the live value, never static: at 0 the box must
              not say "two lanes" while the strip says Ads off (MESITA-3033). */}
          <p className="mt-2">
            {n === 0 ? (
              <>
                <strong>Ads are off:</strong> Premier places rank organically,
                with no · Ad.
              </>
            ) : (
              <>
                <strong>Two lanes.</strong> Home repeats one sponsored slot,
                then {n} organic {n === 1 ? "place" : "places"}, each place once
                (the first lane to place it keeps it). This sets how often
                every Premier buyer&apos;s place appears; the tier (2X · 5X ·
                10X) orders places within the sponsored slots only. A
                sponsored slot&apos;s Premier mark reads · Ad.
              </>
            )}
          </p>
        </>
      }
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.catalog} />}
    >
      {/* ONE RULE (MESITA-3033): each dial draws its own picture under
          itself, so both columns read label · input · hint · picture ·
          (dirty) the saved value. The box is a full-width page card, so
          the breakpoint measures the page, not a narrow column. */}
      <Group title="Hyperparameters">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <NumberField
              label="Half distance (km)"
              value={h}
              min={HALF_KM_MIN}
              max={HALF_KM_MAX}
              decimals
              disabled={off}
              onChange={(halfKm) => proximity({ halfKm })}
              hint={`½ at this distance, ⅓ at twice it. Default ${HALF_KM_DEFAULT} km.`}
            />
            <CurveSparkline halfKm={h} off={off} />
            {hDirty ? (
              <p className="text-muted-foreground type-meta">Saved: {saved.params.proximity.halfKm} km</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <NumberField
              label="Organic places per ad"
              value={n}
              min={BLUE_PER_RED_MIN}
              max={BLUE_PER_RED_MAX}
              disabled={off}
              onChange={lanes}
              hint={`One sponsored slot, then this many organic places. 0 turns ads off. Default ${BLUE_PER_RED_DEFAULT}.`}
            />
            <LaneStrip bluePerRed={n} off={off} />
            {turningAdsOff ? (
              // Muted, not red: red means sponsored in this panel, and the
              // all-grey strip is the alarm (MESITA-3033).
              <p className="text-muted-foreground type-meta flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Saving 0 turns ads off: Premier places still rank, organically, with no · Ad.</span>
              </p>
            ) : null}
            {nDirty ? (
              <p className="text-muted-foreground type-meta">
                Saved: {saved.params.lanes.bluePerRed === 0
                  ? "ads off"
                  : `${saved.params.lanes.bluePerRed} organic per ad`}
              </p>
            ) : null}
          </div>
        </div>
      </Group>
      <Group title="Paging">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Page size"
            value={cfg.map.catalogPageSize}
            min={CATALOG_PAGE_SIZE_MIN}
            max={CATALOG_PAGE_SIZE_MAX}
            disabled={off}
            onChange={pageSize}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          Home draws the ranked list this many places at a time; scrolling to
          the end draws the next page. {CATALOG_PAGE_SIZE_MIN}–{CATALOG_PAGE_SIZE_MAX}.
        </p>
      </Group>
    </PipelineBox>
  );
}

// 5 ─ Consumer Deep Pipeline ───────────────────────────────────────────────
// Soon (MESITA-2345): Deep's only caller is Chat, and no guest reaches Chat
// yet. Its stored settings stay on the blob; the box has no controls.
export function DeepBox() {
  return (
    <PipelineBox
      id="s-deep"
      pipeline="deep"
      title="Consumer Deep Pipeline"
      icon={<Sparkles className={ICON} />}
      explanation="Open-ended discovery for Chat (Don Memo). No guest reaches Chat yet."
    />
  );
}
