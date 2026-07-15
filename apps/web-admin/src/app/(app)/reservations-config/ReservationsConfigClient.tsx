"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, ShieldCheck } from "lucide-react";
import {
  ErrorNote,
  SaveRow,
  SectionCard,
  Switch,
} from "../enricher-config/atlas-ui";
import { updateReservationsConfig } from "./actions";
import {
  channelMeta,
  type ReservationChannel,
  type ReservationsConfig,
} from "./catalog";

export function ReservationsConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: ReservationsConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<ReservationsConfig>(initialConfig);
  const [saved, setSaved] = useState<ReservationsConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Never dirty when the read failed: the form is holding DEFAULT_CONFIG, not
  // the live row, and Save writes the whole blob — one edit would bury the real
  // channel priority under a placeholder.
  const dirty = useMemo(
    () => loadError == null && JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved, loadError],
  );

  const move = (index: number, delta: number) => {
    setCfg((c) => {
      const next = [...c.priority];
      const to = index + delta;
      if (to < 0 || to >= next.length) return c;
      [next[index], next[to]] = [next[to], next[index]];
      return { ...c, priority: next };
    });
    setOk(false);
  };

  const toggleChannel = (key: ReservationChannel) => {
    setCfg((c) => {
      const off = c.disabled.includes(key);
      return {
        ...c,
        disabled: off ? c.disabled.filter((k) => k !== key) : [...c.disabled, key],
      };
    });
    setOk(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateReservationsConfig(cfg);
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

  const live = cfg.priority.filter((k) => !cfg.disabled.includes(k));
  const allParked = live.length === 0;

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<CalendarCheck className="text-secondary h-4 w-4" />}
        title="Channel priority"
        subtitle="The Enricher takes the first channel from the top that the place has a contact for, and writes it to products.reservations. Parked channels never win, even as a place's only contact."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
          ) : null
        }
      >
        <ul className="mt-5 space-y-2">
          {cfg.priority.map((key, idx) => {
            const meta = channelMeta(key);
            const parked = cfg.disabled.includes(key);
            // Rank is the position among channels still in the running — a parked
            // channel has no rank, so numbering never implies it could win.
            const rank = parked ? null : live.indexOf(key) + 1;
            return (
              <li
                key={key}
                className={
                  "border-border bg-card flex items-center gap-3 rounded-2xl border p-3 " +
                  (parked ? "opacity-50" : "")
                }
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0 || pending}
                    onClick={() => move(idx, -1)}
                    aria-label={`Move ${meta.label} up`}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-0.5 transition disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === cfg.priority.length - 1 || pending}
                    onClick={() => move(idx, 1)}
                    aria-label={`Move ${meta.label} down`}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-0.5 transition disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span
                  className={
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums " +
                    (rank === 1
                      ? "bg-secondary/10 text-secondary"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {rank ?? "—"}
                </span>

                <span className="text-lg" aria-hidden>
                  {meta.emoji}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{meta.label}</span>
                    {rank === 1 && (
                      <span className="bg-secondary/10 text-secondary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        first choice
                      </span>
                    )}
                    {parked && (
                      <span className="text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        parked
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {meta.blurb}
                  </p>
                  <p className="text-muted-foreground/70 mt-0.5 font-mono text-[10px]">
                    {meta.source}
                  </p>
                </div>

                <Switch
                  on={!parked}
                  pending={pending}
                  label={`Enable ${meta.label}`}
                  onClick={() => toggleChannel(key)}
                />
              </li>
            );
          })}
        </ul>

        {allParked ? (
          <p className="mt-3 text-xs text-amber-600">
            Every channel is parked — no place could be given an endpoint. Leave at
            least one in the running.
          </p>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Resolution order:{" "}
            <span className="text-foreground font-medium">
              {live.map((k) => channelMeta(k).label).join(" → ")}
            </span>
            . A place with none of these contacts gets no endpoint and stays
            un-bookable until one is found.
          </p>
        )}
      </SectionCard>

      <SectionCard
        icon={<ShieldCheck className="text-secondary h-4 w-4" />}
        title="Operator overrides"
        subtitle="What happens on re-enrich to a channel a human picked by hand on the place's Products tab."
      >
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Keep hand-picked channels</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {cfg.respectAdminOverride
                ? "On — a place whose channel an operator set is left alone by every re-enrich. The operator outranks the pipeline."
                : "Off — every re-enrich re-applies the priority above, overwriting channels operators picked by hand. Only useful for a deliberate backfill."}
            </p>
          </div>
          <Switch
            on={cfg.respectAdminOverride}
            pending={pending}
            label="Keep hand-picked channels"
            onClick={() => {
              setCfg((c) => ({ ...c, respectAdminOverride: !c.respectAdminOverride }));
              setOk(false);
            }}
          />
        </div>
        {!cfg.respectAdminOverride && (
          <p className="mt-3 text-xs text-amber-600">
            With this off, the next enrich of any place clobbers its operator-chosen
            channel. Turn it back on once the backfill is done.
          </p>
        )}
      </SectionCard>

      <div>
        <p className="text-muted-foreground text-xs">
          Enforced live by the Enricher contents stage
          (supabase-cron-enrich-place-contents) on every run — existing places keep
          their current endpoint until they are re-enriched.
        </p>
        <SaveRow
          pending={pending}
          dirty={dirty && !allParked}
          ok={ok}
          onClick={save}
        />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}
