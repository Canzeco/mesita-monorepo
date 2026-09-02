"use client";

// Controls — the Wallet's Credits policy. One box of WIRED knobs plus a parked
// Gifting box. The unrendered key (minHoldHours) still rides the whole blob
// (Ojo/Reservations law): no reader for a floor yet, so it is not a question.
//
// TWO GROUPS IN ONE BOX, BECAUSE THEY WEAR DIFFERENT UNITS. The hold and the
// bonus are priced against each other and read in HOURS; expiry reads in DAYS
// and answers a different question — not when the money wakes up, but when it
// dies. Five fields in one undivided grid is where an operator types 90 into an
// hours box, so every label carries its unit and the rule sits above its pair.

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, CalendarX2, Gift, Hourglass, Percent, Timer } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getControlsConfig, updateControlsConfig } from "./actions";
import { type ControlsConfig } from "./defaults";

export function ControlsConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: ControlsConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<ControlsConfig>(initialConfig);
  const [saved, setSaved] = useState<ControlsConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getControlsConfig();
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

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = (p: Partial<ControlsConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, ...p }));
  };

  // Every term has to be one a place could actually be given. Saying so BEFORE
  // the save runs is the point — the EF clamps either way, and a value that
  // silently snapped on save is how an operator stops trusting the page.
  //
  // Ordered by which correction lands first in normalize, so the note names the
  // number that will actually move.
  const willSnap = cfg.defaultHoldHours > cfg.maxHoldHours
    ? "The default hold is above the ceiling; saving snaps it down."
    : cfg.minExpiryDays * 24 < cfg.maxHoldHours
      ? "Credits would expire before they mature; saving raises the shortest expiry to cover the longest hold."
      : cfg.defaultExpiryDays < cfg.minExpiryDays
        ? "The default expiry is below the shortest a place may set; saving raises it."
        : null;

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const maxHold = Math.max(cfg.minHoldHours, cfg.maxHoldHours);
      // Mirrors _shared/controls-config.ts. The EF normalizes regardless; doing
      // it here too means the value that comes back is the one the page already
      // warned about, rather than a surprise on the round trip.
      const minExpiry = Math.max(Math.ceil(maxHold / 24), cfg.minExpiryDays);
      const next: ControlsConfig = {
        ...cfg,
        maxHoldHours: maxHold,
        defaultHoldHours: Math.min(
          maxHold,
          Math.max(cfg.minHoldHours, cfg.defaultHoldHours),
        ),
        minExpiryDays: minExpiry,
        defaultExpiryDays: Math.max(minExpiry, cfg.defaultExpiryDays),
      };
      const r = await updateControlsConfig(next);
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

  return (
    <div className="space-y-6">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Hourglass className="text-secondary h-4 w-4" />}
        title="Credits"
        subtitle="How long a prepaid balance is held before a guest can spend it, what the place pays for that hold, and how long the Credits live before they expire."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {formatShortDate(updatedAt)}
            </span>
          ) : null
        }
      >
        <div className="mt-4">
          <KnobStatus
            kind="fallback"
            reason="consumer-web-get-controls-config — a place's own hold wins when it has set one"
          />
        </div>

        <p className="text-muted-foreground mt-4 type-label leading-relaxed">
          A place is buying float and the bonus is the rate it pays for it, so
          the two move together. These are what a place inherits when it has set
          neither — today, every place.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NumberField
            icon={<Timer className="text-muted-foreground mt-0.5 h-4 w-4" />}
            label="Default hold before Credits can be spent (hours)"
            value={cfg.defaultHoldHours}
            min={0}
            max={720}
            disabled={pending}
            onChange={(v) => patch({ defaultHoldHours: v })}
          />
          <NumberField
            icon={<Percent className="text-muted-foreground mt-0.5 h-4 w-4" />}
            label="Default bonus on a top-up (%)"
            value={cfg.defaultBonusPct}
            min={0}
            max={100}
            disabled={pending}
            onChange={(v) => patch({ defaultBonusPct: v })}
          />
          <NumberField
            icon={<Hourglass className="text-muted-foreground mt-0.5 h-4 w-4" />}
            label="Longest hold a place may set (hours)"
            value={cfg.maxHoldHours}
            min={0}
            max={720}
            disabled={pending}
            onChange={(v) => patch({ maxHoldHours: v })}
          />
        </div>

        {/* Expiry is the other end of the instrument's life and it is counted
            in DAYS. It gets its own rule, its own sentence and its own pair, so
            the unit change is a visible boundary rather than a suffix an
            operator has to notice on the fifth label in a grid. */}
        <div className="border-border mt-6 border-t pt-5">
          <p className="text-muted-foreground type-label leading-relaxed">
            Unspent Credits expire. This is counted in DAYS from the top-up, not
            from the moment the hold lifts. The guard here is a FLOOR, not a
            ceiling — a place may always sell a longer life, never a shorter one,
            because a short expiry is the term that costs a guest.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <NumberField
              icon={
                <CalendarClock className="text-muted-foreground mt-0.5 h-4 w-4" />
              }
              label="Default expiry on Credits (days)"
              value={cfg.defaultExpiryDays}
              min={0}
              max={3650}
              disabled={pending}
              onChange={(v) => patch({ defaultExpiryDays: v })}
            />
            <NumberField
              icon={
                <CalendarX2 className="text-muted-foreground mt-0.5 h-4 w-4" />
              }
              label="Shortest expiry a place may set (days)"
              value={cfg.minExpiryDays}
              min={0}
              max={3650}
              disabled={pending}
              onChange={(v) => patch({ minExpiryDays: v })}
            />
          </div>
        </div>

        {willSnap ? (
          <p className="text-muted-foreground mt-3 type-label">{willSnap}</p>
        ) : null}

        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadBlocked ? error : null}
        />
      </SectionCard>

      {/* Parked, not hidden: an operator looking for the gifting knobs should
          find out here that there are none yet, rather than concluding the
          console lost them. A page whose engine is unbuilt shows Soon. */}
      <SectionCard
        icon={<Gift className="text-secondary h-4 w-4" />}
        title="Gifting"
        subtitle="Sending Credits to another guest."
      >
        <div className="mt-4">
          <KnobStatus
            kind="not-wired"
            reason="no table, no Edge Function, no recipient model — knobs appear when it ships"
          />
        </div>
      </SectionCard>
    </div>
  );
}
