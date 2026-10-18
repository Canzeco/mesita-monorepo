"use client";

// Discovery: ONE page, four boxes (MESITA-2327): Name Pipeline by Admin ·
// Name Pipeline · Area Pipeline · Deep Pipeline. Each box is a PipelineBox
// and saves only its own slices, so two boxes can never overwrite each other.
// Catalog and Map are views of the Area pipeline, so their knobs sit in the
// Area box; the Chat Agent is Deep's caller, so its prompt sits in the Deep box.

import { Hash, MapPin, RefreshCw, Rows3, ScanSearch, Search, Sparkles } from "lucide-react";
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
  CATALOG_RAIL_CAP_MAX,
  CATALOG_RAIL_CAP_MIN,
  GENERAL_MIN_REVIEWS_MAX,
  AREA_WEIGHT_MAX,
  AREA_WEIGHT_MIN,
  GOOGLE_PULL_STOPS,
  HALF_REVIEWS_MAX,
  HALF_REVIEWS_MIN,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  MAP_RELOAD_PAIRS,
  NAME_ADMIN_MESITA_MAX,
  NAME_ADMIN_TEXT_MAX,
  NAME_IDLE_SEC_MAX,
  NAME_IDLE_SEC_MIN,
  NAME_LANE_COUNT_MAX,
  type DiscoveryConfig,
} from "./catalog";
import { CATALOG_FAMILY_FACTS, CATALOG_SIGNAL_RAILS } from "./discovery-surface";
import { PipelineBox } from "./PipelineBox";

const ICON = "h-5 w-5";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What each box's Save writes (actions.ts `DiscoverySlice`). Exported so
 *  actions.test.ts proves exactly these sets cannot reach each other. */
export const BOX_SLICES = {
  nameAdmin: ["nameAdmin"],
  name: ["nameDeep", "nameLocations", "nameIdle", "general"],
  area: ["map", "catalogRows", "areaSignals"],
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
        "Text Search rows are Find's own call: Mesita's place types and the stored Google floors (map.minRating, minReviews, minPopularity; 0 is off and no box edits them), not Discovery › General.",
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
  const setParam = (bag: "popularity" | "balance", key: string, v: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, params: { ...c.params, [bag]: { ...c.params[bag], [key]: v } } }));
  };
  const dirty =
    !same(cfg.map, saved.map) ||
    cfg.catalog.railCap !== saved.catalog.railCap ||
    !same(params, saved.params);
  return (
    <PipelineBox
      id="s-area"
      pipeline="area"
      title="Area Pipeline"
      icon={<MapPin className={ICON} />}
      explanation={
        <>
          <p>
            Places around an anchor: the device, a picked city, a searched
            destination, a dropped pin or the map&apos;s centre. The radius
            decides who is a candidate; the score orders them. The guest picks
            one scope, and each scope has its own cap:{" "}
            <strong>Google Places</strong> (the nearest places one Google call
            returns inside the radius — places Mesita buys; a place already on
            Mesita shown as its Mesita row) or <strong>Mesita Selected</strong>{" "}
            (only places Mesita has written a profile for — a free read of our
            own rows). The Mesita set is not a subset of the Google places
            bought: a Selected place 3 km away can be absent from Google&apos;s
            nearest 20.
          </p>
          <p className="mt-2">
            The Map and the Feed are two views of this one pipeline, so they
            always agree. Proximity and Popularity add up with the two weights
            below: a missing number lowers a place, it never removes it.
          </p>
        </>
      }
      save={<Save editor={editor} dirty={dirty} slices={BOX_SLICES.area} />}
    >
      <Group title="Candidates and signals">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Radius (km)"
            value={cfg.map.radiusKm}
            min={MAP_RADIUS_KM_MIN}
            max={MAP_RADIUS_KM_MAX}
            decimals
            disabled={off}
            onChange={(radiusKm) => map({ radiusKm })}
          />
          <NumberField
            label="Minimum number of Google reviews"
            value={cfg.map.googleMinReviews}
            min={0}
            max={GENERAL_MIN_REVIEWS_MAX}
            disabled={off}
            onChange={(googleMinReviews) => map({ googleMinReviews })}
          />
          <NumberField
            label="Reviews for half credit"
            value={params.popularity.halfReviews}
            min={HALF_REVIEWS_MIN}
            max={HALF_REVIEWS_MAX}
            disabled={off}
            onChange={(v) => setParam("popularity", "halfReviews", v)}
          />
          <NumberField
            label="Proximity weight"
            value={params.balance.proximity}
            min={AREA_WEIGHT_MIN}
            max={AREA_WEIGHT_MAX}
            disabled={off}
            onChange={(v) => setParam("balance", "proximity", v)}
          />
          <NumberField
            label="Popularity weight"
            value={params.balance.popularity}
            min={AREA_WEIGHT_MIN}
            max={AREA_WEIGHT_MAX}
            disabled={off}
            onChange={(v) => setParam("balance", "popularity", v)}
          />
        </div>
        <p className="text-muted-foreground type-meta">
          Proximity is 1 at the anchor and 0 at the edge of the radius, so the
          radius is its only number. Popularity is rating ÷ 5 × reviews ÷
          (reviews + half credit): a 3★ place is 60% of a 5★ one, and volume
          earns half credit at that many reviews. The score is Proximity ×
          its weight + Popularity × its weight; 0 turns a signal off. The
          reviews floor counts people, cuts Google Places only, and 0 is off.
        </p>
      </Group>
      <Group title="Map view (the Search tab)">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceField
            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Google places"
            hint="Places Mesita buys. One Nearby call answers 20; 40 and 60 wait for a 2–3-call fan-out."
          >
            <div className="flex flex-wrap gap-2">
              {GOOGLE_PULL_STOPS.map((stop) => (
                <ChoicePill
                  key={stop}
                  active={cfg.map.googlePlaces === stop}
                  disabled={off || stop > 20}
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
            hint="Places Mesita reads from its own rows, free."
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
          <ChoiceField
            icon={<RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Reload after"
            hint="The camera must move this far AND wait this long."
          >
            <div className="flex flex-wrap gap-2">
              {MAP_RELOAD_PAIRS.map((pair) => (
                <ChoicePill
                  key={`${pair.km}-${pair.sec}`}
                  active={cfg.map.reloadMinKm === pair.km && cfg.map.reloadMinSec === pair.sec}
                  disabled={off}
                  onClick={() => map({ reloadMinKm: pair.km, reloadMinSec: pair.sec })}
                >
                  {pair.km} km · {pair.sec}s
                </ChoicePill>
              ))}
            </div>
          </ChoiceField>
        </div>
      </Group>
      <Group title="Catalog view (Home's Feed)">
        <div className="max-w-xs">
          <NumberField
            icon={<Rows3 className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Places per row"
            value={cfg.catalog.railCap}
            min={CATALOG_RAIL_CAP_MIN}
            max={CATALOG_RAIL_CAP_MAX}
            disabled={off}
            onChange={(railCap) => {
              setOk(false);
              setCfg((c) => ({ ...c, catalog: { ...c.catalog, railCap } }));
            }}
          />
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Feed rows">
          {CATALOG_SIGNAL_RAILS.map((rail) => (
            <li key={rail.key} className="border-foreground rounded-full border px-3 py-1 text-sm font-semibold">
              <span aria-hidden>{rail.emoji}</span> {rail.label}
            </li>
          ))}
          {CATALOG_FAMILY_FACTS.map((family) => (
            <li key={family.key} className="border-border rounded-full border px-3 py-1 text-sm">
              <span aria-hidden>{family.emoji}</span> {family.label}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground type-meta">
          Row one is the Google Places scope, row two the Mesita Selected
          scope, then one row per family (the Family gate) with its Mesita
          Selected members. A row with nothing in it is hidden.
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
