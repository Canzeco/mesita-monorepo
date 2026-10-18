"use client";

// Discovery › Modes: six boxes, one per mode (MESITA-2303). Each box is a
// ModeBox (Explanation · Sources · Parameters · Save) and saves only its own
// slices, so two boxes can never overwrite each other. A parameter the box
// names that no engine reads yet renders as Not wired, with no stored value.

import { useMemo } from "react";
import {
  Hash,
  MapPin,
  MessageSquare,
  RefreshCw,
  Rows3,
  ScanSearch,
  Search,
  Users,
} from "lucide-react";
import {
  ChoiceField,
  ChoicePill,
  NumberField,
  SaveRow,
  Switch,
  TextAreaField,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { formatShortDate } from "@/lib/format";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  CATALOG_RAIL_CAP_MAX,
  CATALOG_RAIL_CAP_MIN,
  GOOGLE_PULL_STOPS,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  MAP_RELOAD_PAIRS,
  NAME_ADMIN_MESITA_MAX,
  NAME_ADMIN_TEXT_MAX,
  NAME_IDLE_SEC_MAX,
  NAME_IDLE_SEC_MIN,
  NAME_LANE_COUNT_MAX,
  SIGNALS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  weightMaxFor,
  type DiscoveryConfig,
  type SignalKey,
} from "./catalog";
import {
  CATALOG_ALL_ZERO_ERROR,
  CATALOG_LIVE_RANK_KEYS,
  catalogLiveWeightsAllZero,
  type CatalogLiveRankKey,
} from "./catalog-shares";
import { modeSignalState } from "./discovery-matrix";
import { CATALOG_FAMILY_FACTS, CATALOG_SIGNAL_RAILS } from "./discovery-surface";
import { ModeBox } from "./ModeBox";

const ICON = "h-5 w-5";

function useDiscoveryEditor(seed: ConfigSeed<DiscoveryConfig>) {
  return useConfigEditor({ ...seed, load: getDiscoveryConfig });
}

function Saved({ at }: { at: string | null }) {
  return at ? (
    <p className="text-muted-foreground mt-4 type-meta">Last saved {formatShortDate(at)}</p>
  ) : null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// 1 ─ Word by Admin ───────────────────────────────────────────────────────
export function WordAdminBox(seed: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useDiscoveryEditor(seed);
  const dirty = !same(cfg.name.admin, saved.name.admin);
  const off = pending || loadBlocked;
  const a = cfg.name.admin;
  const patch = (p: Partial<DiscoveryConfig["name"]["admin"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, name: { ...c.name, admin: { ...c.name.admin, ...p } } }));
  };
  return (
    <ModeBox
      id="s-word-admin"
      icon={<ScanSearch className={ICON} />}
      title="Word by Admin"
      explanation={
        <p>
          Single Place › Find. An admin types a name; the searches run
          together and merge into one list with duplicates removed. Google rows
          keep Google&apos;s order; Mesita rows are ordered by name match.
          Locations are never shown here. With the last option on, the page
          opens listing every Mesita place, as an empty search.
        </p>
      }
      sources={[
        { name: "Google Places Autocomplete Search", returns: "Google Places while typing" },
        { name: "Google Places Text Search", returns: "Google Places matching the query" },
        { name: "Mesita Places Name Search", returns: "Mesita Places whose name matches" },
      ]}
      save={
        <>
          <Saved at={updatedAt} />
          <SaveRow
            pending={pending}
            dirty={dirty}
            ok={ok && !dirty}
            onClick={() => saveWith((c) => updateDiscoveryConfig(c, ["nameAdmin"]))}
            loadError={loadBlocked ? error : null}
          />
        </>
      }
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
          label="Max Mesita name rows"
          value={a.mesitaCount}
          min={1}
          max={NAME_ADMIN_MESITA_MAX}
          disabled={off}
          onChange={(mesitaCount) => patch({ mesitaCount })}
        />
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="text-sm font-medium">Show results on an empty query</span>
          <Switch
            on={a.emptyQuery}
            pending={off}
            label="Show results on an empty query"
            onClick={() => patch({ emptyQuery: !a.emptyQuery })}
          />
        </div>
      </div>
      <p className="text-muted-foreground type-meta">
        0 Autocomplete rows means Find does not call Autocomplete. Mesita name
        rows stop at {NAME_ADMIN_MESITA_MAX}.
      </p>
    </ModeBox>
  );
}

// 2 ─ Word ─────────────────────────────────────────────────────────────────
export function WordBox(seed: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useDiscoveryEditor(seed);
  const dirty =
    !same(cfg.name.deep, saved.name.deep) ||
    cfg.name.locations !== saved.name.locations ||
    cfg.name.idleSec !== saved.name.idleSec ||
    !same(cfg.general, saved.general);
  const off = pending || loadBlocked;
  const deep = (p: Partial<DiscoveryConfig["name"]["deep"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, name: { ...c.name, deep: { ...c.name.deep, ...p } } }));
  };
  const general = (p: Partial<DiscoveryConfig["general"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, general: { ...c.general, ...p } }));
  };
  return (
    <ModeBox
      id="s-word"
      icon={<Search className={ICON} />}
      title="Word"
      explanation={
        <p>
          The guest&apos;s Search bar, one search: it runs once the guest has
          stopped typing for the seconds below. The three searches run together and
          merge into one list with duplicates removed. Google rows keep
          Google&apos;s order; Mesita rows are ordered by name match. A
          Location (a city, a region) shows with a location icon, and picking
          one moves the map. Picking a place moves the map there and makes it
          the first card. Only active places and the reviews floor also cut
          the Map&apos;s Google answer and admin Find.
        </p>
      }
      sources={[
        { name: "Google Places Autocomplete Search", returns: "Google Places and Locations" },
        { name: "Google Places Text Search", returns: "Google Places matching the query" },
        { name: "Mesita Places Name Search", returns: "Mesita Places whose name matches" },
      ]}
      save={
        <>
          <Saved at={updatedAt} />
          <SaveRow
            pending={pending}
            dirty={dirty}
            ok={ok && !dirty}
            onClick={() => saveWith((c) => updateDiscoveryConfig(c, ["nameDeep", "nameLocations", "nameIdle", "general"]))}
            loadError={loadBlocked ? error : null}
          />
        </>
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
          onChange={(idleSec) => {
            setOk(false);
            setCfg((c) => ({ ...c, name: { ...c.name, idleSec } }));
          }}
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
          label="Max Mesita name rows"
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
          max={100_000}
          disabled={off}
          onChange={(minReviews) => general({ minReviews })}
        />
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="text-sm font-medium">Only active places</span>
          <Switch
            on={cfg.general.requireActive}
            pending={off}
            label="Only active places"
            onClick={() => general({ requireActive: !cfg.general.requireActive })}
          />
        </div>
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <span className="text-sm font-medium">Show Locations</span>
          <Switch
            on={cfg.name.locations}
            pending={off}
            label="Show Locations"
            onClick={() => {
              setOk(false);
              setCfg((c) => ({ ...c, name: { ...c.name, locations: !c.name.locations } }));
            }}
          />
        </div>
      </div>
      <p className="text-muted-foreground type-meta">
        Minimum Google reviews counts people, never stars. 0 is off.
      </p>
    </ModeBox>
  );
}

// 3 ─ Map ──────────────────────────────────────────────────────────────────
export function MapBox(seed: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useDiscoveryEditor(seed);
  const dirty = useMemo(() => !same(cfg.map, saved.map), [cfg.map, saved.map]);
  const off = pending || loadBlocked;
  const map = cfg.map;
  const patch = (p: Partial<DiscoveryConfig["map"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };
  return (
    <ModeBox
      id="s-map"
      icon={<MapPin className={ICON} />}
      title="Map"
      explanation={
        <p>
          The Search tab. The guest picks one scope on the Filters sheet:{" "}
          <strong>Google Places</strong>, every Google place inside the radius
          around the camera, a place already on Mesita shown as its Mesita
          row, or <strong>Mesita Selected</strong>, the places Mesita has
          written a profile for. Both are ordered by the same engine as the
          Feed&apos;s first two rows, set on Places. A Google-only pin draws
          its family emoji, never a photo. The map reloads once the camera has
          moved past both thresholds.
        </p>
      }
      sources={[
        { name: "Google Places Nearby Search", returns: "The closest Google Places, one call of 20" },
        { name: "Mesita Places Nearby Search", returns: "The closest Mesita Selected places" },
      ]}
      save={
        <>
          <Saved at={updatedAt} />
          <SaveRow
            pending={pending}
            dirty={dirty}
            ok={ok && !dirty}
            onClick={() => saveWith((c) => updateDiscoveryConfig(c, ["map"]))}
            loadError={loadBlocked ? error : null}
          />
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Radius (km)"
          value={map.radiusKm}
          min={MAP_RADIUS_KM_MIN}
          max={MAP_RADIUS_KM_MAX}
          decimals
          disabled={off}
          onChange={(radiusKm) => patch({ radiusKm })}
        />
        <ChoiceField icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />} label="How many pins" hint="Google answers at most 20 per call.">
          <div className="flex flex-wrap gap-2">
            {GOOGLE_PULL_STOPS.map((stop) => (
              <ChoicePill
                key={stop}
                active={map.pinCount === stop}
                disabled={off}
                onClick={() => patch({ pinCount: stop })}
              >
                {stop}
              </ChoicePill>
            ))}
          </div>
        </ChoiceField>
        <NumberField
          label="Minimum number of Google reviews"
          value={map.googleMinReviews}
          min={0}
          max={100_000}
          disabled={off}
          onChange={(googleMinReviews) => patch({ googleMinReviews })}
        />
        <ChoiceField icon={<RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />} label="Reload after" hint="The camera must move this far AND wait this long.">
          <div className="flex flex-wrap gap-2">
            {MAP_RELOAD_PAIRS.map((pair) => (
              <ChoicePill
                key={`${pair.km}-${pair.sec}`}
                active={map.reloadMinKm === pair.km && map.reloadMinSec === pair.sec}
                disabled={off}
                onClick={() => patch({ reloadMinKm: pair.km, reloadMinSec: pair.sec })}
              >
                {pair.km} km · {pair.sec}s
              </ChoicePill>
            ))}
          </div>
        </ChoiceField>
      </div>
      <p className="text-muted-foreground type-meta">
        The radius and the reviews floor are the Feed&apos;s too. The floor
        counts people, never stars, and cuts Google places only: the higher of
        it and the guest&apos;s own stop wins. 0 is off.
      </p>
    </ModeBox>
  );
}

// 4 ─ Places ───────────────────────────────────────────────────────────────
/** Every signal the Google Places scope reads (the Map mask), in SIGNALS order. */
const GOOGLE_SIGNALS: SignalKey[] = SIGNALS.map((s) => s.key).filter(
  (key) => modeSignalState("map", key) === "on",
);
const SIGNAL_LABEL = new Map(SIGNALS.map((s) => [s.key, s.label]));
const isSelectedKey = (key: SignalKey): key is CatalogLiveRankKey =>
  (CATALOG_LIVE_RANK_KEYS as readonly string[]).includes(key);
const RANK_ROWS: SignalKey[] = [
  ...GOOGLE_SIGNALS,
  ...CATALOG_LIVE_RANK_KEYS.filter((key) => !GOOGLE_SIGNALS.includes(key)),
];

function WeightInput({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      value={value}
      min={WEIGHT_MIN}
      max={max}
      step={0.1}
      disabled={disabled}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(WEIGHT_MIN, n)));
      }}
      className="border-border bg-card focus:border-foreground h-10 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
    />
  );
}

export function PlacesBox(seed: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useDiscoveryEditor(seed);
  const dirty =
    !same(cfg.weightsByMode.map, saved.weightsByMode.map) ||
    !same(cfg.catalog.ranking, saved.catalog.ranking) ||
    cfg.catalog.railCap !== saved.catalog.railCap;
  const allZero = catalogLiveWeightsAllZero(cfg.catalog.ranking);
  const off = pending || loadBlocked;
  const setGoogle = (key: SignalKey, v: number) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      weightsByMode: { ...c.weightsByMode, map: { ...c.weightsByMode.map, [key]: v } },
    }));
  };
  const setSelected = (key: CatalogLiveRankKey, v: number) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      catalog: { ...c.catalog, ranking: { ...c.catalog.ranking, [key]: v } },
    }));
  };
  return (
    <ModeBox
      id="s-catalog"
      icon={<Rows3 className={ICON} />}
      title="Places"
      explanation={
        <p>
          Home&apos;s Feed. Row one is <strong>Google Places</strong>, row two
          is <strong>Mesita Selected</strong>, then one row per family with its
          Mesita Selected members. One engine orders every row and the Map:
          the radius picks the set, the weights below sort it, distance breaks
          ties. Weights differ by scope, never by view. Google appears in row
          one only, and only row one has a Google reviews floor: 100+, or the
          Map&apos;s, whichever is higher. A
          Google-only card draws its family emoji, never a photo. A row with
          nothing in it is hidden.
        </p>
      }
      sources={[
        { name: "Google Places Nearby Search", returns: "The closest Google Places · row one" },
        { name: "Mesita Places Catalog Search", returns: "Mesita Selected places · row two and the families" },
      ]}
      save={
        <>
          {allZero ? (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {CATALOG_ALL_ZERO_ERROR}
            </p>
          ) : null}
          <Saved at={updatedAt} />
          <SaveRow
            pending={pending}
            dirty={dirty && !allZero}
            ok={ok && !dirty}
            onClick={() =>
              saveWith((c) => updateDiscoveryConfig(c, ["weightsMap", "catalogRanking", "catalogRows"]))
            }
            loadError={loadBlocked ? error : null}
          />
        </>
      }
    >
      <div className="max-w-xs">
        <NumberField
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
      <div>
        <p className="text-muted-foreground type-meta mb-2 font-semibold">Rows, in order</p>
        <ul className="flex flex-wrap gap-2" aria-label="Feed rows">
          {CATALOG_SIGNAL_RAILS.map((rail) => (
            <li
              key={rail.key}
              className="border-foreground rounded-full border px-3 py-1 text-sm font-semibold"
            >
              <span aria-hidden>{rail.emoji}</span> {rail.label}
            </li>
          ))}
          {CATALOG_FAMILY_FACTS.map((family) => (
            <li key={family.key} className="border-border rounded-full border px-3 py-1 text-sm">
              <span aria-hidden>{family.emoji}</span> {family.label}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-muted-foreground type-meta mb-2 font-semibold">
          Ranking · exponents by scope, shared with the Map · 0 turns a signal off
        </p>
        <div className="grid max-w-xl grid-cols-[minmax(7rem,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          <span />
          <span className="text-muted-foreground type-meta font-semibold">Google Places</span>
          <span className="text-muted-foreground type-meta font-semibold">Mesita Selected</span>
          {RANK_ROWS.map((key) => {
            const label = SIGNAL_LABEL.get(key) ?? key;
            return (
              <div key={key} className="contents">
                <span className="text-sm font-medium">{label}</span>
                {GOOGLE_SIGNALS.includes(key) ? (
                  <WeightInput
                    label={`${label} · Google Places`}
                    value={cfg.weightsByMode.map[key]}
                    max={weightMaxFor(key)}
                    disabled={off}
                    onChange={(v) => setGoogle(key, v)}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm" aria-label={`${label} · Google Places: not read`}>
                    —
                  </span>
                )}
                {isSelectedKey(key) ? (
                  <WeightInput
                    label={`${label} · Mesita Selected`}
                    value={cfg.catalog.ranking[key]}
                    max={WEIGHT_MAX}
                    disabled={off}
                    onChange={(v) => setSelected(key, v)}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm" aria-label={`${label} · Mesita Selected: not read`}>
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground type-meta mt-2">
          Mesita Selected weights are relative: doubling both changes nothing.
          Enriched is its gate, not a weight.
        </p>
      </div>
    </ModeBox>
  );
}

// 5 ─ Social ───────────────────────────────────────────────────────────────
export function SocialBox() {
  return (
    <ModeBox
      id="s-social"
      icon={<Users className={ICON} />}
      title="Social"
      explanation={
        <p>
          Home&apos;s Social tab, which guests see as Soon. It lists events
          that places host, as events, not as the places themselves.
        </p>
      }
      sources={[
        {
          name: "Mesita Social Catalog Search",
          returns: "Events at places",
          notWired: "No engine retrieves events",
        },
      ]}
    >
      <p className="text-sm">None.</p>
    </ModeBox>
  );
}

// 6 ─ Chat ─────────────────────────────────────────────────────────────────
export function ChatBox(seed: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useDiscoveryEditor(seed);
  const dirty = !same(cfg.chat, saved.chat);
  return (
    <ModeBox
      id="s-chat"
      icon={<MessageSquare className={ICON} />}
      title="Chat"
      explanation={
        <p>
          Home&apos;s Chat tab, Don Memo, which guests see as Soon. The whole
          thread goes to the model with the prompt below in front of it, and
          the answer comes back as text. Description Search is used by Chat
          only. The model is chosen on Models.
        </p>
      }
      sources={[
        {
          name: "Mesita Places Description Search",
          returns: "Mesita Places whose summary matches the question",
          notWired: "Chat calls no source yet",
        },
      ]}
      save={
        <>
          <Saved at={updatedAt} />
          <SaveRow
            pending={pending}
            dirty={dirty}
            ok={ok && !dirty}
            onClick={() => saveWith((c) => updateDiscoveryConfig(c, ["chat"]))}
            loadError={loadBlocked ? error : null}
          />
        </>
      }
    >
      <TextAreaField
        label="Prompt"
        value={cfg.chat.prompt}
        rows={8}
        maxLength={12_000}
        disabled={pending || loadBlocked}
        onChange={(prompt) => {
          setOk(false);
          setCfg((c) => ({ ...c, chat: { prompt } }));
        }}
      />
    </ModeBox>
  );
}
