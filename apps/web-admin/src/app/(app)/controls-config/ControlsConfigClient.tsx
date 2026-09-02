"use client";

// Controls — the Wallet's Credits policy. One box of WIRED knobs plus a parked
// Gifting box. The unrendered key (minHoldHours) still rides the whole blob
// (Ojo/Reservations law): no reader for a floor yet, so it is not a question.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Gift, Hourglass, Percent, Timer } from "lucide-react";
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

  // The default has to be a hold a place could actually be given. Saying so
  // BEFORE the save runs is the point — the EF clamps either way, and a value
  // that silently snapped on save is how an operator stops trusting the page.
  const defaultAboveCeiling =
    cfg.defaultHoldHours > cfg.maxHoldHours
      ? "The default hold is above the ceiling; saving snaps it down."
      : null;

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const maxHold = Math.max(cfg.minHoldHours, cfg.maxHoldHours);
      const next: ControlsConfig = {
        ...cfg,
        maxHoldHours: maxHold,
        defaultHoldHours: Math.min(
          maxHold,
          Math.max(cfg.minHoldHours, cfg.defaultHoldHours),
        ),
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
        subtitle="How long a prepaid balance is held before a guest can spend it, and what the place pays for that hold."
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

        {defaultAboveCeiling ? (
          <p className="text-muted-foreground mt-3 type-label">
            {defaultAboveCeiling}
          </p>
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
