"use client";

// THE QUALITY FLOOR THAT LIVES INSIDE A SOURCE BOX (Pato, 2026-09-08).
//
// Nine source boxes, nine floor blocks, one shape. Redundancy is the point:
// every box states the floor that cuts it, even when two boxes name the same
// number. What is NOT duplicated is the INPUT.
//
// OWNER / MIRROR. For each key exactly one box owns the input; the others
// print the same number read-only and say where it is set. Three live inputs
// on `general.minReviews` would let an operator type 50 into Autocomplete and
// watch Nearby follow, which spends the credibility of every number on the
// page to buy nothing — the backend has one key either way.
//
// The floors do NOT split by vendor. `general` gates the `name_embedding`
// pool in `consumer-search-lane.ts:846`, which IS Mesita Places Name Search,
// so a Mesita box mirrors a key that also governs the three Google ones.
//
// A SOON SOURCE NEVER GETS AN INPUT. The four have no engine, so a live field
// there would have to write some other slice — editing "Mesita Social Browse
// Search" would silently move the Home rails. It prints the state instead.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Layers, Star, Users } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { NumberField, SaveRow, Switch } from "@/components/admin-ui/config";
import {
  getDiscoveryConfig,
  updateDiscoveryConfig,
  type DiscoverySlice,
} from "./actions";
import {
  GENERAL_MIN_REVIEWS_MAX,
  GOOGLE_PULL_STOPS,
  MIN_RATING_MAX,
  type DiscoveryConfig,
} from "./catalog";

export type FloorSeed = {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
};

function FloorFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border mt-5 border-t pt-4">
      <p className="text-muted-foreground type-label font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Read-only twin of an owned floor. Same numbers, no input, names the owner. */
export function FloorMirror({
  rows,
  ownedBy,
  note,
  label = "Quality floor",
}: {
  rows: { label: string; value: string }[];
  ownedBy: string;
  note?: string;
  label?: string;
}) {
  return (
    <FloorFrame label={label}>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5"
          >
            <span className="text-muted-foreground text-sm">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 type-meta">
        Set on <span className="text-foreground font-semibold">{ownedBy}</span>.
        One key, so this box shows it rather than offering a second input that
        would move the same number.
        {note ? ` ${note}` : ""}
      </p>
    </FloorFrame>
  );
}

/**
 * The floor line for a Soon source. One sentence in ConfigSoon's footer, never
 * a control: Pato's 2026-08-21 law for an engine that does not exist is that
 * the knobs are DELETED from the markup, not staged. A field here would also
 * have to write some other source's key, so editing "Mesita Social Browse
 * Search" would move the Home rails.
 */
export function FloorSoonNote() {
  return (
    <p className="text-muted-foreground/80 max-w-md type-meta">
      Quality floor: none. No engine reads this source yet, so there is nothing
      for a floor to cut.
    </p>
  );
}

/** Shared editor state for the three owner boxes. One slice, one Save. */
function useFloorEditor(
  seed: FloorSeed,
  slice: DiscoverySlice,
  isDirty: (a: DiscoveryConfig, b: DiscoveryConfig) => boolean,
) {
  const [cfg, setCfg] = useState<DiscoveryConfig>(seed.initialConfig);
  const [saved, setSaved] = useState<DiscoveryConfig>(seed.initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(seed.loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!seed.loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(
    seed.initialUpdatedAt,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const dirty = useMemo(() => isDirty(cfg, saved), [cfg, saved, isDirty]);

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, [slice]);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  const busy = pending || loadBlocked;
  return { cfg, setCfg, setOk, dirty, pending, busy, error, loadBlocked, ok, updatedAt, save };
}

function FloorTail({
  updatedAt,
  note,
  ...rest
}: {
  updatedAt: string | null;
  note: string;
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onClick: () => void;
  loadError: string | null;
}) {
  return (
    <>
      <p className="text-muted-foreground mt-3 type-meta">{note}</p>
      {updatedAt ? (
        <p className="text-muted-foreground mt-3 type-meta">
          Last saved {formatShortDate(updatedAt)}
        </p>
      ) : null}
      <SaveRow {...rest} />
    </>
  );
}

/** Google Autocomplete owns `general` — the post-Google wipe. */
export function GeneralFloorOwner({ seed }: { seed: FloorSeed }) {
  const ed = useFloorEditor(
    seed,
    "general",
    (a, b) =>
      a.general.minReviews !== b.general.minReviews ||
      a.general.requireActive !== b.general.requireActive,
  );
  const g = ed.cfg.general;
  const patch = (p: Partial<typeof g>) => {
    ed.setOk(false);
    ed.setCfg((c) => ({ ...c, general: { ...c.general, ...p } }));
  };
  return (
    <FloorFrame label="Quality floor">
      {ed.error ? <ErrorNote message={ed.error} /> : null}
      <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Only active places</p>
          <p className="text-muted-foreground type-meta">
            Google&rsquo;s OPERATIONAL. Closed both ways goes, and so does a
            place that never told us: unknown is not active.
          </p>
        </div>
        <Switch
          on={g.requireActive}
          pending={ed.busy}
          onClick={() => patch({ requireActive: !g.requireActive })}
          label="Only active places"
        />
      </div>
      <div className="mt-3">
        <NumberField
          icon={<Users className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Minimum Google reviewers"
          value={g.minReviews}
          min={0}
          max={GENERAL_MIN_REVIEWS_MAX}
          disabled={ed.busy}
          onChange={(minReviews) => patch({ minReviews })}
        />
      </div>
      <FloorTail
        updatedAt={ed.updatedAt}
        note="How many PEOPLE reviewed the place on Google — the count, never the stars. A 4.9 with two reviewers fails a floor of 10; a 3.1 with 400 passes it. This box owns the wipe for every lane that queries Google, plus Mesita Places Name Search. 0 is off; any number drops a place with no review count too."
        pending={ed.pending}
        dirty={ed.dirty}
        ok={ed.ok}
        onClick={ed.save}
        loadError={ed.loadBlocked ? ed.error : null}
      />
    </FloorFrame>
  );
}

/** Google Nearby owns the Map floors — the only rating floor on a Google lane. */
export function MapFloorOwner({
  seed,
  label = "Quality floor",
}: {
  seed: FloorSeed;
  label?: string;
}) {
  const ed = useFloorEditor(
    seed,
    "mapFloors",
    (a, b) =>
      a.map.minReviews !== b.map.minReviews || a.map.minRating !== b.map.minRating,
  );
  const m = ed.cfg.map;
  const patch = (p: { minReviews?: number; minRating?: number }) => {
    ed.setOk(false);
    ed.setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };
  return (
    <FloorFrame label={label}>
      {ed.error ? <ErrorNote message={ed.error} /> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          icon={<Users className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Minimum reviewers"
          value={m.minReviews}
          min={0}
          max={GENERAL_MIN_REVIEWS_MAX}
          disabled={ed.busy}
          onChange={(minReviews) => patch({ minReviews })}
        />
        <NumberField
          icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Minimum rating (stars)"
          value={m.minRating}
          min={0}
          max={MIN_RATING_MAX}
          decimals
          disabled={ed.busy}
          onChange={(minRating) => patch({ minRating })}
        />
      </div>
      <FloorTail
        updatedAt={ed.updatedAt}
        note="Reviewers is a HEAD COUNT, rating is the stars — two different cuts. Applied EF-side after the Nearby fetch, and maxed with the listed-pool floor on the Mesita Nearby lane. The General wipe above runs as well."
        pending={ed.pending}
        dirty={ed.dirty}
        ok={ed.ok}
        onClick={ed.save}
        loadError={ed.loadBlocked ? ed.error : null}
      />
    </FloorFrame>
  );
}

/**
 * Google Nearby owns the PULL — how many rows one map load buys from Google.
 *
 * This is the only knob on Search Sources that costs money by itself. Google
 * caps ONE Nearby Search (New) at 20 with no page token, so 40 and 60 are 2
 * and 3 billed requests over disjoint slices of the battery. The box says so
 * rather than presenting three equal-looking stops.
 *
 * It is NOT the guest's How many. That one caps the pins painted on the map
 * and stays on the Filters sheet; this one caps what we are willing to pay
 * Google for before any of that happens.
 */
export function NearbyPullOwner({ seed }: { seed: FloorSeed }) {
  const ed = useFloorEditor(
    seed,
    "mapPull",
    (a, b) => a.map.googlePull !== b.map.googlePull,
  );
  const pull = ed.cfg.map.googlePull;
  const patch = (googlePull: number) => {
    ed.setOk(false);
    ed.setCfg((c) => ({ ...c, map: { ...c.map, googlePull } }));
  };
  const calls = Math.max(1, Math.round(pull / GOOGLE_PULL_STOPS[0]));
  return (
    <FloorFrame label="How many Google pulls">
      {ed.error ? <ErrorNote message={ed.error} /> : null}
      <p className="text-muted-foreground mt-3 type-meta">
        How many places one map load buys from Google. Google caps a single
        Nearby Search at {GOOGLE_PULL_STOPS[0]} and offers no next page, so 40
        and 60 are 2 and 3 <span className="text-foreground font-semibold">billed</span>{" "}
        requests over disjoint slices of the battery, deduped by place id.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {GOOGLE_PULL_STOPS.map((stop) => {
          const active = pull === stop;
          return (
            <button
              key={stop}
              type="button"
              disabled={ed.busy}
              onClick={() => patch(stop)}
              aria-pressed={active}
              className={
                active
                  ? "bg-foreground text-background inline-flex h-9 items-center rounded-lg px-3.5 type-body font-bold tabular-nums transition disabled:opacity-50"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3.5 type-body font-semibold tabular-nums transition disabled:opacity-50"
              }
            >
              {stop}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-3 type-meta">
        <Layers className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        {calls === 1
          ? "One Nearby request per cache-miss cell — today's spend."
          : `${calls} Nearby requests per cache-miss cell — ${calls}x today's spend on this lane.`}
      </p>
      <FloorTail
        updatedAt={ed.updatedAt}
        note="A pull can only split as far as the battery allows: with one Super on there is nothing to slice, so it stays 20 whatever is picked here. The guest's How many still caps the pins."
        pending={ed.pending}
        dirty={ed.dirty}
        ok={ed.ok}
        onClick={ed.save}
        loadError={ed.loadBlocked ? ed.error : null}
      />
    </FloorFrame>
  );
}

/** Mesita Places Nearby owns `filters` — the listed-pool floor. */
export function FiltersFloorOwner({ seed }: { seed: FloorSeed }) {
  const ed = useFloorEditor(
    seed,
    "filters",
    (a, b) =>
      a.filters.minReviews !== b.filters.minReviews ||
      a.filters.minRating !== b.filters.minRating,
  );
  const f = ed.cfg.filters;
  const patch = (p: { minReviews?: number; minRating?: number }) => {
    ed.setOk(false);
    ed.setCfg((c) => ({ ...c, filters: { ...c.filters, ...p } }));
  };
  return (
    <FloorFrame label="Quality floor">
      {ed.error ? <ErrorNote message={ed.error} /> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          icon={<Users className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Minimum reviewers"
          value={f.minReviews}
          min={0}
          max={GENERAL_MIN_REVIEWS_MAX}
          disabled={ed.busy}
          onChange={(minReviews) => patch({ minReviews })}
        />
        <NumberField
          icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
          label="Minimum rating (stars)"
          value={f.minRating}
          min={0}
          max={MIN_RATING_MAX}
          decimals
          disabled={ed.busy}
          onChange={(minRating) => patch({ minRating })}
        />
      </div>
      <FloorTail
        updatedAt={ed.updatedAt}
        note="This is the listed-pool floor, so it also cuts the Home rails, the Pay and viewport-map branch, and Swipe. Here it is maxed with the Google Nearby floor. Most of a young catalog is unrated, so reach for the count first."
        pending={ed.pending}
        dirty={ed.dirty}
        ok={ed.ok}
        onClick={ed.save}
        loadError={ed.loadBlocked ? ed.error : null}
      />
    </FloorFrame>
  );
}
