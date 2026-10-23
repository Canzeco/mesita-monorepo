"use client";

// Discovery: ONE page, four boxes (MESITA-2327): Name Pipeline by Admin ·
// Name Pipeline · Area Pipeline · Deep Pipeline. Each box is a PipelineBox
// and saves only its own slices, so two boxes can never overwrite each other.
// Catalog and Map are views of the Area pipeline, ranked one way, so their
// knobs sit in the Area box; the Chat Agent is Deep's caller, so its prompt sits in the Deep box.

import { MapPin, ScanSearch, Search, Sparkles } from "lucide-react";
import {
  NumberField,
  SaveRow,
  Switch,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import {
  AREA_SOURCE_ON,
  type AreaSourceKey,
  GENERAL_MIN_REVIEWS_MAX,
  googleCallsPerLoad,
  HALF_KM_MAX,
  HALF_KM_MIN,
  MAP_PLACES_SHOWN_MAX,
  MAP_POPULARITY_FLOOR_MAX,
  MAP_POPULARITY_FLOOR_MIN,
  MAP_PLACES_SHOWN_MIN,
  MAP_PROXIMITY_WEIGHT_MAX,
  MAP_PROXIMITY_WEIGHT_MIN,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  MAP_RELOAD_IDLE_SEC_MAX,
  MAP_RELOAD_IDLE_SEC_MIN,
  MAP_SELECTED_FACTOR_MAX,
  MAP_SELECTED_FACTOR_MIN,
  NAME_ADMIN_MESITA_MAX,
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
  area: ["map", "areaSignals"],
} as const satisfies Record<string, readonly DiscoverySlice[]>;

/** The Area box's four switches, in the order the pipeline runs them. */
const AREA_SOURCE_SOURCES: ReadonlyArray<{ key: AreaSourceKey; label: string }> = [
  { key: "googlePopular", label: "Google Popular" },
  { key: "googleClosest", label: "Google Closest" },
  { key: "mesitaPopular", label: "Mesita Popular" },
  { key: "mesitaClosest", label: "Mesita Closest" },
];

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

// 1 ─ Name Pipeline by Admin ──────────────────────────────────────────────
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
      title="Name Pipeline by Admin"
      icon={<ScanSearch className={ICON} />}
      callers={["Admin Single Place › Find"]}
      explanation={
        <p>
          The Name pipeline as an admin runs it. An admin types a name;
          Autocomplete and the Mesita rows run through the guest bar&apos;s
          lane, with its rules. The Text Search column is Find&apos;s own
          call: it applies Mesita&apos;s place types but not Discovery ›
          General&apos;s active check or the reviews minimum. Locations are never
          shown here. With the last option on, the page opens listing every
          Mesita place, as an empty search.
        </p>
      }
      scoring="Rows found by more sources come first, then Text Search rank, then Autocomplete rank, then Name. Duplicates merge."
      rules={[
        "Autocomplete and Mesita rows follow the guest bar's rules: closed places never show, the Area box's Minimum Google reviews cuts Google rows (never a Mesita row), and a Google row must be one of Mesita's place types.",
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
        <NumberField
          label="Max Mesita rows"
          value={a.mesitaCount}
          min={1}
          max={NAME_ADMIN_MESITA_MAX}
          disabled={off}
          onChange={(mesitaCount) => patch({ mesitaCount })}
        />
        <SwitchRow
          label="Show results on an empty query"
          on={a.emptyQuery}
          disabled={off}
          onClick={() => patch({ emptyQuery: !a.emptyQuery })}
        />
      </div>
      <p className="text-muted-foreground type-meta">
        0 Autocomplete rows means Find does not call Autocomplete. Mesita rows
        stop at {NAME_ADMIN_MESITA_MAX}.
      </p>
    </PipelineBox>
  );
}

// 2 ─ Name Pipeline ────────────────────────────────────────────────────────
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
      title="Name Pipeline"
      icon={<Search className={ICON} />}
      callers={["The guest's Search bar"]}
      explanation={
        <p>
          The guest knows which place they want. The search runs once they
          stop typing for the seconds below; the sources run together and
          merge into one list with duplicates removed. A Location (a city, a
          region) shows with a location icon, and picking one moves the map.
          Picking a place moves the map there and makes it the first card.
          Neither gate applies: a place Mesita has created is findable by
          name before its profile is written. The always-on rules below
          still hold: closed places never show, a Google row must be one of
          Mesita&apos;s place types, and the Area box&apos;s Minimum Google
          reviews cuts Google rows (never a Mesita row).
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
        <NumberField
          label="Max Mesita rows"
          value={cfg.name.deep.mesitaCount}
          min={0}
          max={NAME_LANE_COUNT_MAX}
          disabled={off}
          onChange={(mesitaCount) => deep({ mesitaCount })}
        />
        <SwitchRow
          label="Show Locations"
          on={cfg.name.locations}
          disabled={off}
          onClick={() => name({ locations: !cfg.name.locations })}
        />
      </div>
      <p className="text-muted-foreground type-meta">
        0 rows turns a source off. The one reviews minimum lives in the Area
        box&apos;s Gates (MESITA-2702). A Mesita row needs a Name score of
        0.4 or more.
      </p>
    </PipelineBox>
  );
}

// 3 ─ Area Pipeline ────────────────────────────────────────────────────────
export function AreaBox(seed: ConfigSeed<DiscoveryConfig>) {
  const editor = useDiscoveryEditor(seed);
  const { cfg, setCfg, saved, setOk, pending, loadBlocked } = editor;
  const off = pending || loadBlocked;
  const map = (p: Partial<DiscoveryConfig["map"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };
  const params = cfg.params;
  const setHalfKm = (halfKm: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, proximity: { halfKm } } }));
  };
  const toggle = (key: AreaSourceKey) => map({ [key]: cfg.map[key] > 0 ? 0 : AREA_SOURCE_ON });
  const calls = googleCallsPerLoad(cfg.map);
  const allOff = AREA_SOURCE_SOURCES.every(({ key }) => !(cfg.map[key] > 0));
  const dirty = !same(cfg.map, saved.map) || !same(params, saved.params);
  return (
    <PipelineBox
      id="s-area"
      pipeline="area"
      title="Area Pipeline"
      icon={<MapPin className={ICON} />}
      explanation={
        <>
          <p>
            Places around a <strong>point</strong> inside a <strong>radius</strong>:
            the Map&apos;s cross and its screen radius (the cross&apos;s distance to
            the nearest edge of the visible map), or on Home a saved pin and the
            radius the guest picked for it, else the device and the
            current-location radius below. One radius for Google and Mesita.
          </p>
          <p className="mt-2">
            Four sources, each on or off: Google Popular, Google Closest, Mesita
            Popular and Mesita Closest, 20 places each. They merge into one pool
            (a place found twice is one card), then Home and the Map rank it the
            same way: score = Proximity<sup>a</sup> × Popularity<sup>b</sup>,
            × the Selected factor for a Selected place. No point: Mesita
            Popular alone, by Popularity<sup>b</sup> × the Selected factor.
          </p>
        </>
      }
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.area} />}
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
        </div>
        <p className="text-muted-foreground type-meta">
          The pipeline takes a point and a radius. On Home the radius is the
          one the guest saved with the pin, else this one (the device, or a pin
          saved without a radius); the Map uses the screen radius, and this one
          only when it has no screen to measure (no view yet, or one wider than
          100 km). It is also Chat&apos;s search radius.{" "}
          {MAP_RADIUS_KM_MIN}–{MAP_RADIUS_KM_MAX} km (Google&apos;s circle cap).
        </p>
      </Group>
      <Group title="Sources">
        {AREA_SOURCE_SOURCES.map(({ key, label }) => (
          <SwitchRow
            key={key}
            label={label}
            on={cfg.map[key] > 0}
            disabled={off}
            onClick={() => toggle(key)}
          />
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Minimum Google reviews"
            value={cfg.map.googleMinReviews}
            min={0}
            max={GENERAL_MIN_REVIEWS_MAX}
            disabled={off}
            onChange={(googleMinReviews) => map({ googleMinReviews })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Places shown"
            value={cfg.map.placesShown}
            min={MAP_PLACES_SHOWN_MIN}
            max={MAP_PLACES_SHOWN_MAX}
            disabled={off}
            onChange={(placesShown) => map({ placesShown })}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          The sources bring up to {MAP_PLACES_SHOWN_MAX} places (4 × 20); after the
          merge and the sort, Home and the Map show the top this many.{" "}
          {MAP_PLACES_SHOWN_MIN}–{MAP_PLACES_SHOWN_MAX}.
        </p>
        <p className="type-meta font-medium">
          Billed Google calls per load: {calls}
        </p>
        <p className="text-muted-foreground type-meta">
          Each Google source is one Nearby Search call on every Home load and
          every Map reload (the Map reloads each time the guest stops moving
          it), within the per-guest quota in the Always-on rules. Google
          Popular asks for the most prominent 20 in the circle, Google Closest
          for the nearest 20. The reviews minimum filters the two Google
          sources only: it counts people and cuts a Google place after Google
          bills it, never a Mesita row (MESITA-2702: the same minimum on the
          Search bar and admin Find&apos;s Autocomplete column); 0 is off. At{" "}
          {cfg.map.googleMinReviews}, most of Google Closest&apos;s nearest
          places are corner spots under it. Mesita Popular is the 20 Mesita
          places in the circle with the highest Popularity<sup>b</sup> × the
          Selected factor (the score without Proximity), Mesita Closest the 20
          nearest; both are free.
        </p>
        {allOff ? (
          <p className="text-destructive type-meta">
            Every source is off: the Map and Home show nothing.
          </p>
        ) : null}
      </Group>
      <Group title="Signals">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Proximity weight (a)"
            value={cfg.map.proximityWeight}
            min={MAP_PROXIMITY_WEIGHT_MIN}
            max={MAP_PROXIMITY_WEIGHT_MAX}
            decimals
            disabled={off}
            onChange={(proximityWeight) => map({ proximityWeight })}
          />
          <NumberField
            label="Popularity weight (b)"
            value={cfg.map.popularityWeight}
            min={MAP_PROXIMITY_WEIGHT_MIN}
            max={MAP_PROXIMITY_WEIGHT_MAX}
            decimals
            disabled={off}
            onChange={(popularityWeight) => map({ popularityWeight })}
          />
          <NumberField
            label="Minimum Popularity"
            value={cfg.map.popularityFloor}
            min={MAP_POPULARITY_FLOOR_MIN}
            max={MAP_POPULARITY_FLOOR_MAX}
            decimals
            disabled={off}
            onChange={(popularityFloor) => map({ popularityFloor })}
          />
          <NumberField
            label="Distance for half credit (km)"
            value={params.proximity.halfKm}
            min={HALF_KM_MIN}
            max={HALF_KM_MAX}
            decimals
            disabled={off}
            onChange={setHalfKm}
          />
          <NumberField
            label="Selected factor"
            value={cfg.map.selectedFactor}
            min={MAP_SELECTED_FACTOR_MIN}
            max={MAP_SELECTED_FACTOR_MAX}
            decimals
            disabled={off}
            onChange={(selectedFactor) => map({ selectedFactor })}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          a and b rank the Map and Home alike: below 1 softens a signal,
          above 1 sharpens it, 0 ignores it. Proximity is 1 ÷ (1 + distance ÷
          half credit): 1 at the point, ½ at that many km, ⅓ at twice it,
          never 0, and the same whatever the radius (the radius only decides
          who is in). A place whose Popularity is under the Minimum
          Popularity (now {cfg.map.popularityFloor}; 0 is off) never shows on
          Home, the Map or Chat, Google or Mesita, whatever its score: 3 is
          about 4★ × 5 reviews. Popularity is ln(1 + reviews × stars), never normalized:
          4.6★ × 1,000 reviews ≈ 8.4, 4.0★ × 30 ≈ 4.8; a place with no Google
          numbers scores 0 and sinks, never disappears. The score is the plain
          product Proximity<sup>a</sup> × Popularity<sup>b</sup> × the
          Selected factor (now {cfg.map.selectedFactor}; 1 is off) for a place
          marked Selected in Single Place, × 1 for every other place. Selected
          never saves a place from the Minimum Popularity.
        </p>
      </Group>
      <Group title="Map view (the Search tab)">
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
        </div>
        <p className="text-muted-foreground type-meta">
          The Search map reloads when the guest stops moving it, at most once
          every this many seconds counted from the last reload, with no
          distance gate (MESITA-2451). {MAP_RELOAD_IDLE_SEC_MIN}–{MAP_RELOAD_IDLE_SEC_MAX} s.
        </p>
      </Group>
    </PipelineBox>
  );
}

// 4 ─ Deep Pipeline ────────────────────────────────────────────────────────
// Soon (MESITA-2345): Deep's only caller is Chat, and no guest reaches Chat
// yet. Its stored settings stay on the blob; the box has no controls.
export function DeepBox() {
  return (
    <PipelineBox
      id="s-deep"
      pipeline="deep"
      title="Deep Pipeline"
      icon={<Sparkles className={ICON} />}
      explanation="Open-ended discovery for Chat (Don Memo). No guest reaches Chat yet."
    />
  );
}
