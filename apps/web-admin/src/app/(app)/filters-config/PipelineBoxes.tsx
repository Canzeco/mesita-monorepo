"use client";

// Discovery: ONE page, four boxes (MESITA-2327): Name Pipeline by Admin ·
// Name Pipeline · Area Pipeline · Deep Pipeline. Each box is a PipelineBox
// and saves only its own slices, so two boxes can never overwrite each other.
// Catalog and Map are views of the Area pipeline, ranked one way, so their
// knobs sit in the Area box; the Chat Agent is Deep's caller, so its prompt sits in the Deep box.

import { Hash, MapPin, ScanSearch, Search, Sparkles } from "lucide-react";
import {
  ChoiceField,
  ChoicePill,
  NumberField,
  SaveRow,
  Switch,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import {
  GENERAL_MIN_REVIEWS_MAX,
  GOOGLE_PULL_STOPS,
  HALF_REVIEWS_MAX,
  HALF_REVIEWS_MIN,
  REACH_KM_MAX,
  REACH_KM_MIN,
  SELECTED_OTHER_MAX,
  SELECTED_OTHER_MIN,
  MAP_PROXIMITY_WEIGHT_MAX,
  MAP_PROXIMITY_WEIGHT_MIN,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  MAP_RELOAD_IDLE_SEC_MAX,
  MAP_RELOAD_IDLE_SEC_MIN,
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
  name: ["nameDeep", "nameLocations", "nameIdle", "general"],
  area: ["map", "areaSignals"],
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
          General&apos;s active check or reviews floor. Locations are never
          shown here. With the last option on, the page opens listing every
          Mesita place, as an empty search.
        </p>
      }
      scoring="Rows found by more sources come first, then Text Search rank, then Autocomplete rank, then Name. Duplicates merge."
      rules={[
        "Autocomplete and Mesita rows follow the guest bar's rules: closed places never show, Discovery › General's reviews floor cuts them, and a Google row must be one of Mesita's place types.",
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
    cfg.name.idleSec !== saved.name.idleSec ||
    !same(cfg.general, saved.general);
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
          Mesita&apos;s place types, and the reviews floor below cuts every
          row.
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
        <NumberField
          label="Minimum number of Google reviews"
          value={cfg.general.minReviews}
          min={0}
          max={GENERAL_MIN_REVIEWS_MAX}
          disabled={off}
          onChange={(minReviews) => {
            setOk(false);
            setCfg((c) => ({ ...c, general: { ...c.general, minReviews } }));
          }}
        />
        <SwitchRow
          label="Show Locations"
          on={cfg.name.locations}
          disabled={off}
          onClick={() => name({ locations: !cfg.name.locations })}
        />
      </div>
      <p className="text-muted-foreground type-meta">
        0 rows turns a source off. The reviews floor counts people, never
        stars, cuts Google and Mesita rows of the guest bar and of admin
        Find&apos;s Autocomplete and Mesita columns, never the Area pipeline,
        and 0 is off. A Mesita row needs a Name score of 0.4 or more.
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
  const setHalfReviews = (halfReviews: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, popularity: { halfReviews } } }));
  };
  const setSelectedOther = (otherFactor: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, selected: { otherFactor } } }));
  };
  const setReachKm = (reachKm: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, proximity: { reachKm } } }));
  };
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
            Places around a <strong>point</strong>: the Map&apos;s cross, or on
            Home the device or a saved pin. No point, no Google: Home lists
            Mesita&apos;s own places by Popularity alone. There is no Territory:
            no view searches a rectangle or a saved area (MESITA-2500,
            MESITA-2603). Google and Mesita candidates join one pool: merged,
            deduped by Google Place ID, gated, scored and ranked before any page
            is cut. The source is never a guest filter.
          </p>
          <p className="mt-2">
            The Map (the Search tab) and Home&apos;s Places rank one way
            (MESITA-2504, MESITA-2516): score = Proximity<sup>a</sup> ×
            Popularity<sup>1</sup> × Selected<sup>1</sup>. On the Map the radius and Proximity&apos;s
            reach are the screen&apos;s (the cross&apos;s distance to the nearest
            edge of the visible map), so 1 at the cross and 0 at the edge mean
            the same at every zoom. Home has no screen, so it reads the Home
            radius and the Home proximity reach below.
          </p>
        </>
      }
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.area} />}
    >
      <Group title="Sources">
        <SwitchRow
          label="Buy Google places"
          on={cfg.map.googleFill}
          disabled={off}
          onClick={() => map({ googleFill: !cfg.map.googleFill })}
        />
        <p className="text-muted-foreground type-meta">
          Off: the Map and Home show Mesita places only and nothing is billed.
          On: Google Nearby Search fills the pool, within the per-guest quota
          in the Always-on rules.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChoiceField
            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Google places on the Map"
            hint="20 · 40 · 60 = 1 / 2 / 3 billed Nearby calls per Map load (a place two calls return counts once). The Map reloads each time the guest stops moving it."
          >
            <div className="flex flex-wrap gap-2">
              {GOOGLE_PULL_STOPS.map((stop) => (
                <ChoicePill
                  key={stop}
                  active={cfg.map.mapGooglePlaces === stop}
                  disabled={off}
                  onClick={() => map({ mapGooglePlaces: stop })}
                >
                  {stop}
                </ChoicePill>
              ))}
            </div>
          </ChoiceField>
          <ChoiceField
            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Google places on Home"
            hint="20 · 40 · 60 = 1 / 2 / 3 billed Nearby calls per Home load (a place two calls return counts once)."
          >
            <div className="flex flex-wrap gap-2">
              {GOOGLE_PULL_STOPS.map((stop) => (
                <ChoicePill
                  key={stop}
                  active={cfg.map.googlePlaces === stop}
                  disabled={off}
                  onClick={() => map({ googlePlaces: stop })}
                >
                  {stop}
                </ChoicePill>
              ))}
            </div>
          </ChoiceField>
          <ChoiceField
            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Mesita places"
            hint="Ready Mesita places read free from our own rows, on the Map and Home: the best this many by score join the pool."
          >
            <div className="flex flex-wrap gap-2">
              {GOOGLE_PULL_STOPS.map((stop) => (
                <ChoicePill
                  key={stop}
                  active={cfg.map.mesitaPlaces === stop}
                  disabled={off}
                  onClick={() => map({ mesitaPlaces: stop })}
                >
                  {stop}
                </ChoicePill>
              ))}
            </div>
          </ChoiceField>
        </div>
      </Group>
      <Group title="Gates">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Home radius (km)"
            value={cfg.map.radiusKm}
            min={MAP_RADIUS_KM_MIN}
            max={MAP_RADIUS_KM_MAX}
            decimals
            disabled={off}
            onChange={(radiusKm) => map({ radiusKm })}
          />
          <NumberField
            label="Minimum Google reviews"
            value={cfg.map.googleMinReviews}
            min={0}
            max={GENERAL_MIN_REVIEWS_MAX}
            disabled={off}
            onChange={(googleMinReviews) => map({ googleMinReviews })}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          The Home radius decides who is a candidate around Home&apos;s point
          and never scores; the Map uses it only when it has no screen to
          measure (no view yet, or one wider than 100 km), and Chat reads
          inside it. {MAP_RADIUS_KM_MIN}–{MAP_RADIUS_KM_MAX} km (Google&apos;s
          circle cap). The reviews minimum counts people, cuts Google places
          only (never a Mesita row), and 0 is off. Family is the guest&apos;s
          own chip or row; closed places never show, on every pipeline.
        </p>
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
            label="Home proximity reach (km)"
            value={params.proximity.reachKm}
            min={REACH_KM_MIN}
            max={REACH_KM_MAX}
            decimals
            disabled={off}
            onChange={setReachKm}
          />
          <NumberField
            label="Reviews for half credit"
            value={params.popularity.halfReviews}
            min={HALF_REVIEWS_MIN}
            max={HALF_REVIEWS_MAX}
            disabled={off}
            onChange={setHalfReviews}
          />
          <NumberField
            label="Selected for every other place"
            value={params.selected.otherFactor}
            min={SELECTED_OTHER_MIN}
            max={SELECTED_OTHER_MAX}
            decimals
            disabled={off}
            onChange={setSelectedOther}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          a ranks the Map and Home alike: below 1 softens distance, above 1
          sharpens it, 0 ignores it; Popularity and Selected keep exponent 1.
          Proximity is 1 at the point, ½ at half the reach and 0 at the reach
          and beyond: on the Map the reach is the screen radius, on Home the
          Home proximity reach. A Home place between the reach and the Home
          radius scores 0 and is ordered by distance alone
          {params.proximity.reachKm < cfg.map.radiusKm
            ? ` (now ${params.proximity.reachKm}–${cfg.map.radiusKm} km)`
            : ""}
          . Popularity is rating ÷ 5 × reviews ÷ (reviews + half credit): a 3★
          place is 60% of a 5★ one, and volume earns half credit at that many
          reviews; a place with no Google numbers scores 0 and sinks, never
          disappears. Selected is 1 for a Mesita Selected place and the number
          above ({SELECTED_OTHER_MIN}–{SELECTED_OTHER_MAX}) for every other, a
          Google-only place included; never 0, so it orders and never hides.
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
