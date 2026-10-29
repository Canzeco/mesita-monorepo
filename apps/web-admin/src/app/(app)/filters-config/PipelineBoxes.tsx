"use client";

// Discovery: ONE page (MESITA-2327), five boxes, five pipelines (Pato,
// MESITA-2779, MESITA-2909): Admin Name · Consumer Name · Consumer Map ·
// Consumer Catalog · Consumer Deep. Each box is a PipelineBox and saves only
// its own slices, so two boxes can never overwrite each other. The Map and the
// Catalog were one Area pipeline until MESITA-2909; the Minimum Popularity
// they share sits in the Map box. Premier's factor is the paid tier, no knob
// (the Selected boost retired with Selected, MESITA-2925). The Chat Agent is
// Deep's caller, so its prompt sits in the Deep box.

import { LayoutGrid, MapPin, ScanSearch, Search, Sparkles } from "lucide-react";
import {
  NumberField,
  SaveRow,
  Switch,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import {
  CATALOG_PAGE_SIZE_MAX,
  CATALOG_PAGE_SIZE_MIN,
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
  const pageSize = (catalogPageSize: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, catalogPageSize } }));
  };
  const dirty = cfg.map.catalogPageSize !== saved.map.catalogPageSize || !same(params, saved.params);
  const h = params.proximity.halfKm;
  const at = (k: number) => catalogProximity(k * h, h).toFixed(2);
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
            lowered.
          </p>
          <p className="mt-2">
            <strong>Two lanes, one and one.</strong> The <strong>red</strong>{" "}
            lane is the Premier places, ranked by Proximity × Popularity × the
            Premier factor; the <strong>blue</strong> lane is every place,
            ranked by Proximity × Popularity alone. Home shows red, blue,
            red, blue… each place once (the first lane to place it keeps it),
            so how much of Home is paid is this ratio, not the factor. A red
            slot reads <strong>Sponsored</strong>. The Map stays one list:
            its screen radius bounds it.
          </p>
          <p className="mt-2">
            Premier counts at any distance inside its lane: past the half
            distance the score is half distance ÷ distance, so a Premier 10X
            beats a place up to about ten times closer, and one in another
            city never tops Home.
          </p>
          <p className="mt-2">
            No location: Popularity × the Premier factor alone. Mesita places
            only (no Google call). Chat ranks every ready Mesita place in its
            radius the same way.
          </p>
        </>
      }
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.catalog} />}
    >
      <Group title="Signals">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Half distance (km)"
            value={params.proximity.halfKm}
            min={HALF_KM_MIN}
            max={HALF_KM_MAX}
            decimals
            disabled={off}
            onChange={(halfKm) => proximity({ halfKm })}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          Proximity is 1 ÷ (1 + distance ÷ half distance): 1 at the guest,
          ½ at the half distance, ⅓ at twice it, never 0. At {h} km:
          {" "}{at(0.5)} at half of it, {at(2)} at twice it, {at(4)} at four
          times it. Inside the half distance Popularity decides; past it
          twice as far is half the credit, so a better place wins only up
          to about 1.8× farther. Smaller favours nearer places; bigger
          favours popular ones. {HALF_KM_MIN}–{HALF_KM_MAX} km.
        </p>
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
