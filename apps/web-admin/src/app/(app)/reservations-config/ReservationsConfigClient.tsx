"use client";

// Reservations Config — the Reservationist's operating limits.
//
// MINIMAL PAGE (Pato, 2026-08-21: "make this much simpler by far … simple and
// clean UI minimalist few words"). It was five cards for six controls, each
// switch carrying a paragraph for its on state AND another for its off state.
//
// Unlike the other pages in the reduction, NOTHING here is staged — all six
// controls are read by live code — so the cut is boxes and words, never knobs:
//
//   • TWO boxes, split by the only question that matters: is this call real?
//     Calls = what actually dials out. Testing = the overrides that fake it.
//   • The KILL SWITCH LEADS. It was the last control on the page, under two
//     number fields, which is the wrong end for the one switch you reach for
//     during a runaway loop or a credit emergency.
//   • One line of help per control, and only where the label doesn't say it.
//     Prose appears for a DANGEROUS state — test mode off, cap bypass on,
//     kill switch on — because those are the three an operator can leave set
//     by accident and not notice.
//
// STOP RENDERING, NEVER STOP CARRYING still applies: `attempts` (fixed at 2 by
// protocol), the phone-only channel shape, and the legacy `consumerNumber` have
// no controls, and save spreads the whole object so they survive a write.
//
// WHOLE-BLOB save; `dirty` gates on loadError so a failed read can never
// overwrite the live singleton (MESITA-737).

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  FlaskConical,
  OctagonPause,
  Phone,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow, SectionCard, Switch } from "../enricher-config/atlas-ui";
import { getReservationsConfig, updateReservationsConfig } from "./actions";
import {
  looksLikePhone,
  type NeedsAttentionRow,
  type ReservationsConfig,
} from "./catalog";

// Phone-only eligible set (MESITA-842). Written on every save so the Intaker
// and the update EF stay aligned with the voice-only serving path.
const PHONE_ONLY_CHANNELS: Pick<ReservationsConfig, "priority" | "disabled"> = {
  priority: ["phone"],
  disabled: [],
};

/** A labelled switch row. One line of help, and only when it earns one. */
function Row({
  label,
  help,
  danger,
  on,
  pending,
  onClick,
}: {
  label: string;
  help?: string;
  danger?: boolean;
  on: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {help ? (
          <p
            className={`mt-0.5 text-xs ${danger ? "font-medium text-amber-600" : "text-muted-foreground"}`}
          >
            {help}
          </p>
        ) : null}
      </div>
      <Switch on={on} pending={pending} label={label} onClick={onClick} />
    </div>
  );
}

/** A small integer field — a daily meter. */
function Cap({
  label,
  help,
  value,
  pending,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  pending: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="number"
        min={1}
        max={1000}
        value={value}
        disabled={pending}
        onChange={(e) => onChange(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
        className="border-border bg-card focus:border-foreground h-9 w-full max-w-[8rem] rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
      />
      <span className="text-muted-foreground text-xs">{help}</span>
    </label>
  );
}

export function ReservationsConfigClient({
  initialConfig,
  initialUpdatedAt,
  initialNeedsAttention,
  loadError,
}: {
  initialConfig: ReservationsConfig;
  initialUpdatedAt: string | null;
  initialNeedsAttention: NeedsAttentionRow[];
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<ReservationsConfig>(initialConfig);
  const [saved, setSaved] = useState<ReservationsConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [attention, setAttention] = useState<NeedsAttentionRow[]>(initialNeedsAttention);

  // Re-fetch on mount so a client-side nav to the page shows the live row, not a
  // stale server render. Success clears a failed-load Save block (MESITA-737).
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getReservationsConfig();
      if (!active) {
        return;
      }
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setAttention(r.needsAttention);
      setLoadBlocked(false);
      setError(null);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const testInvalid = cfg.testCall.enabled && !looksLikePhone(cfg.testCall.number);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = (next: Partial<ReservationsConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    // Force the phone-only channel shape — there is no control for it, but the
    // stored blob must stay a valid, phone-first policy for the Intaker.
    const payload: ReservationsConfig = {
      ...cfg,
      ...PHONE_ONLY_CHANNELS,
      // consumerNumber rides along untouched — legacy field from the retired
      // Playground, kept so stored rows stay shape-stable.
      testCall: { ...cfg.testCall, number: cfg.testCall.number.trim() },
    };
    startTransition(async () => {
      const r = await updateReservationsConfig(payload);
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

  const whyAttention = (row: NeedsAttentionRow): string => {
    if (row.notice_state === "failed") {
      return row.notice_kind === "venue_cancel"
        ? "Place never told the table was cancelled"
        : "Guest never told the table was cancelled";
    }
    if (row.attempts_state === "error") return "Booking run died";
    if (row.callback_state === "failed") return "Guest call could not be placed";
    return "Place confirmed, guest never picked up";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Only renders when there is something to act on, so it costs nothing on
          a normal day and is the first thing read on a bad one. */}
      {attention.length > 0 && (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          title={`Needs attention (${attention.length})`}
          subtitle="These do not fix themselves."
        >
          <ul className="mt-5 space-y-2">
            {attention.map((row) => (
              <li
                key={row.id}
                className="border-border bg-card flex flex-col gap-1 rounded-2xl border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    #{row.reference_code ?? row.id.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 type-meta font-semibold text-red-700">
                    {row.status}
                  </span>
                  {row.is_test && (
                    <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 type-meta font-medium">
                      test
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {new Date(row.reserved_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs font-medium text-red-700">{whyAttention(row)}</p>
                {row.last_call_status && (
                  <p className="text-muted-foreground text-xs">{row.last_call_status}</p>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* CALLS — what actually dials out. Kill switch first. */}
      <SectionCard
        icon={<Phone className="text-secondary h-4 w-4" />}
        title="Calls"
        subtitle="Every reservation is a real, metered phone call."
      >
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <OctagonPause className="h-4 w-4 text-red-600" />
              Stop all calls
            </p>
            {cfg.limits.killSwitch ? (
              <p className="mt-0.5 text-xs font-medium text-red-600">
                Nothing is dialling. Resumes a minute after you turn this off.
              </p>
            ) : null}
          </div>
          <Switch
            on={cfg.limits.killSwitch}
            pending={pending}
            label="Stop all calls"
            onClick={() =>
              patch({ limits: { ...cfg.limits, killSwitch: !cfg.limits.killSwitch } })
            }
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Cap
            label="Reschedules per ticket, daily"
            help="Each one buys fresh place calls."
            value={cfg.limits.reschedulesPerTicketPerDay}
            pending={pending}
            onChange={(v) =>
              patch({ limits: { ...cfg.limits, reschedulesPerTicketPerDay: v } })
            }
          />
          <Cap
            label="Calls per place, daily"
            help="Bookings and cancel notices share the meter."
            value={cfg.limits.venueCallsPerPlacePerDay}
            pending={pending}
            onChange={(v) =>
              patch({ limits: { ...cfg.limits, venueCallsPerPlacePerDay: v } })
            }
          />
        </div>

        <div className="mt-3">
          <Row
            label="Keep hand-picked contacts"
            help={
              cfg.respectAdminOverride
                ? undefined
                : "Next enrich overwrites contacts an operator chose."
            }
            danger={!cfg.respectAdminOverride}
            on={cfg.respectAdminOverride}
            pending={pending}
            onClick={() => patch({ respectAdminOverride: !cfg.respectAdminOverride })}
          />
        </div>
      </SectionCard>

      {/* TESTING — the two overrides that make a run fake. Both belong off. */}
      <SectionCard
        icon={<FlaskConical className="text-secondary h-4 w-4" />}
        title="Testing"
        subtitle="Check both before a real run."
      >
        <div className="mt-5">
          <Row
            label="Test mode"
            help={
              cfg.testCall.enabled
                ? "Every call dials the test number, never a real place."
                : "The agent is calling real businesses."
            }
            danger={!cfg.testCall.enabled}
            on={cfg.testCall.enabled}
            pending={pending}
            onClick={() =>
              patch({ testCall: { ...cfg.testCall, enabled: !cfg.testCall.enabled } })
            }
          />
        </div>

        <label className="mt-3 flex flex-col gap-2">
          <span className="text-sm font-medium">Test number</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+52 444 549 9597"
            value={cfg.testCall.number}
            disabled={pending || !cfg.testCall.enabled}
            onChange={(e) => patch({ testCall: { ...cfg.testCall, number: e.target.value } })}
            className="border-border bg-card focus:border-foreground h-9 w-full max-w-sm rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
          />
          {testInvalid ? (
            <span className="text-xs text-amber-600">
              Needs E.164 — a leading + and country code.
            </span>
          ) : null}
        </label>

        <div className="mt-3">
          <Row
            label="Ignore the monthly cap"
            help={
              cfg.unlimitedReservations
                ? "Hides the paywall Premium depends on."
                : undefined
            }
            danger={cfg.unlimitedReservations}
            on={cfg.unlimitedReservations}
            pending={pending}
            onClick={() => patch({ unlimitedReservations: !cfg.unlimitedReservations })}
          />
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty && !testInvalid}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? (error ?? "Failed to load Reservations config") : null}
      />
      {error && <ErrorNote message={error} />}
    </div>
  );
}
