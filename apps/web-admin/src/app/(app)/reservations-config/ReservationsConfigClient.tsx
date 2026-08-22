"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  FlaskConical,
  Gauge,
  // Aliased: the lucide export is named `Infinity`, which would shadow the
  // global of the same name for this whole module.
  Infinity as InfinityIcon,
  OctagonPause,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow, SectionCard, Switch } from "../enricher-config/atlas-ui";
import { getReservationsConfig, updateReservationsConfig } from "./actions";
import {
  looksLikePhone,
  type NeedsAttentionRow,
  type ReservationsConfig,
} from "./catalog";

// Phone-only eligible set (MESITA-842). Written on every save so the Enricher
// and the update EF stay aligned with the voice-only serving path.
const PHONE_ONLY_CHANNELS: Pick<ReservationsConfig, "priority" | "disabled"> = {
  priority: ["phone"],
  disabled: [],
};

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

  const testInvalid =
    cfg.testCall.enabled && !looksLikePhone(cfg.testCall.number);

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
    // Force the phone-only channel shape — the section above is read-only, but the
    // stored blob must stay a valid, phone-first policy for the Enricher.
    const payload: ReservationsConfig = {
      ...cfg,
      ...PHONE_ONLY_CHANNELS,
      // consumerNumber rides along untouched — legacy field from the retired
      // Playground, kept so stored rows stay shape-stable.
      testCall: {
        ...cfg.testCall,
        number: cfg.testCall.number.trim(),
      },
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
        ? "Place release NOT delivered — the place may still hold a cancelled table"
        : "Guest was never told their table was cancelled";
    }
    if (row.attempts_state === "error") return "Booking run died — see status below";
    if (row.callback_state === "failed") return "Guest call could not be placed";
    return "Place confirmed but the guest never picked up — table exists, owner unaware";
  };

  return (
    <div className="space-y-6">
      {/* Needs attention — the protocol exists because states nobody reads
          stop silently. This list is the reader: every terminal-bad state a
          human must act on, straight from the same GET as the config. */}
      {attention.length > 0 && (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          title={`Needs attention (${attention.length})`}
          subtitle="Tickets in a terminal-bad state: failed cancel notices, dead booking runs, unreached guests on confirmed tables. These do not fix themselves."
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
                  <span className="bg-red-500/10 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                    {row.status}
                  </span>
                  {row.is_test && (
                    <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
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

      {/* How it works — the shape of the agent, so the knobs below have context. */}
      <SectionCard
        icon={<FlaskConical className="text-secondary h-4 w-4" />}
        title="Test mode"
        subtitle="While test mode is on, every reservation call dials the test number below instead of the place's real line — whichever place the guest booked. So we can run the whole flow end to end without ringing a single business."
      >
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Test mode</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {cfg.testCall.enabled
                ? "On — the agent ignores each place's real phone and dials the test number below. Keep this on until we're ready to call real places."
                : "Off — the agent calls each place's actual reservation line. Only turn test mode off when you mean to reach real businesses."}
            </p>
          </div>
          <Switch
            on={cfg.testCall.enabled}
            pending={pending}
            label="Test mode"
            onClick={() =>
              patch({
                testCall: { ...cfg.testCall, enabled: !cfg.testCall.enabled },
              })
            }
          />
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Phone className="text-muted-foreground h-4 w-4" />
            Business test number
          </span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+52 444 549 9597"
            value={cfg.testCall.number}
            disabled={pending || !cfg.testCall.enabled}
            onChange={(e) =>
              patch({ testCall: { ...cfg.testCall, number: e.target.value } })
            }
            className="border-border bg-card focus:border-foreground h-9 w-full max-w-sm rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
          />
          {testInvalid ? (
            <span className="text-xs text-amber-600">
              Enter an E.164 number — a leading + and country code, e.g.
              +5215512345678.
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              E.164 format (leading +, country code). Stands in for the
              place&apos;s line: the only number the agent dials while test mode
              is on — reserve from the consumer app and the place leg rings
              here instead of a real place.
            </span>
          )}
        </label>
      </SectionCard>

      {/* Call attempts — fixed by protocol, shown only so the number is never a mystery. */}
      <SectionCard
        icon={<ShieldCheck className="text-secondary h-4 w-4" />}
        title="Operator overrides"
        subtitle="What happens on re-enrich to a reservation contact a human picked by hand on the place's Products tab."
      >
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Keep hand-picked contacts</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {cfg.respectAdminOverride
                ? "On — a place whose reservation contact an operator set is left alone by every re-enrich. The operator outranks the pipeline."
                : "Off — every re-enrich re-applies the default, overwriting contacts operators picked by hand. Only useful for a deliberate backfill."}
            </p>
          </div>
          <Switch
            on={cfg.respectAdminOverride}
            pending={pending}
            label="Keep hand-picked contacts"
            onClick={() =>
              patch({ respectAdminOverride: !cfg.respectAdminOverride })
            }
          />
        </div>
        {!cfg.respectAdminOverride && (
          <p className="mt-3 text-xs text-amber-600">
            With this off, the next enrich of any place clobbers its operator-chosen
            contact. Turn it back on once the backfill is done.
          </p>
        )}
      </SectionCard>

      {/* Testing-only cap bypass. Lives next to the test-call override because
          both exist for the same reason: keeping a test run unblocked. */}
      <SectionCard
        icon={<InfinityIcon className="text-secondary h-4 w-4" />}
        title="Unlimited reservations"
        subtitle="Testing switch — lets any consumer keep booking past their class's monthly cap."
      >
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Ignore the monthly cap</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {cfg.unlimitedReservations
                ? "On — the per-class monthly reservation limit is skipped for EVERY consumer. Booking never hits the paywall."
                : "Off — each consumer is held to their class's monthly reservation limit (Standard is capped; Premium and above are unlimited)."}
            </p>
          </div>
          <Switch
            on={cfg.unlimitedReservations}
            pending={pending}
            label="Ignore the monthly cap"
            onClick={() =>
              patch({ unlimitedReservations: !cfg.unlimitedReservations })
            }
          />
        </div>
        {cfg.unlimitedReservations && (
          <p className="mt-3 text-xs text-amber-600">
            This hides the exact paywall the Premium upsell depends on — nobody can
            reach the limit while it&apos;s on. Turn it off before any real run.
          </p>
        )}
      </SectionCard>

      {/* Abuse & cost guards — every unit of abuse here is a metered phone call. */}
      <SectionCard
        icon={<Gauge className="text-secondary h-4 w-4" />}
        title="Call limits & kill switch"
        subtitle="Abuse and cost guards. Reschedules reset the place-call budget, so both doors are capped; the kill switch holds every outbound reservation call until it's flipped back."
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Reschedules per ticket per day</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={cfg.limits.reschedulesPerTicketPerDay}
              disabled={pending}
              onChange={(e) =>
                patch({
                  limits: {
                    ...cfg.limits,
                    reschedulesPerTicketPerDay: Math.max(
                      1,
                      Math.trunc(Number(e.target.value) || 1),
                    ),
                  },
                })
              }
              className="border-border bg-card focus:border-foreground h-9 w-full max-w-[10rem] rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
            />
            <span className="text-muted-foreground text-xs">
              Each reschedule resets the ticket&apos;s call attempts — i.e. buys
              fresh place calls. Over the cap the app says &quot;try again
              tomorrow&quot;.
            </span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Outbound place calls per day</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={cfg.limits.venueCallsPerPlacePerDay}
              disabled={pending}
              onChange={(e) =>
                patch({
                  limits: {
                    ...cfg.limits,
                    venueCallsPerPlacePerDay: Math.max(
                      1,
                      Math.trunc(Number(e.target.value) || 1),
                    ),
                  },
                })
              }
              className="border-border bg-card focus:border-foreground h-9 w-full max-w-[10rem] rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
            />
            <span className="text-muted-foreground text-xs">
              Booking calls and cancel notices share one daily meter per place —
              N guests can&apos;t make Mesita ring one restaurant all day. Over
              the cap, calls defer six hours.
            </span>
          </label>
        </div>
        <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <OctagonPause className="h-4 w-4 text-red-600" />
              Kill switch
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {cfg.limits.killSwitch
                ? "ON — no outbound reservation call of any kind is being placed. Everything parks and resumes within a minute of turning this off."
                : "Off — calls flow normally. Flip this on to stop ALL outbound reservation calls instantly (runaway loop, credit emergency, place complaint)."}
            </p>
          </div>
          <Switch
            on={cfg.limits.killSwitch}
            pending={pending}
            label="Kill switch"
            onClick={() =>
              patch({ limits: { ...cfg.limits, killSwitch: !cfg.limits.killSwitch } })
            }
          />
        </div>
        {cfg.limits.killSwitch && (
          <p className="mt-3 text-xs font-medium text-red-600">
            While this is on, NO place is called and NO guest is called — bookings
            park as scheduled and retry after you turn it off. Don&apos;t forget it.
          </p>
        )}
      </SectionCard>

      <div>
        <p className="text-muted-foreground text-xs">
          Channel selection is enforced live by the Enricher contents stage
          (supabase-cron-enrich-place-contents). The test number and attempt count
          are read by the reservation agent when it places a call.
        </p>
        <SaveRow
          pending={pending}
          dirty={dirty && !testInvalid}
          ok={ok}
          onClick={save}
          loadError={
            loadBlocked ? (error ?? "Failed to load Reservations config") : null
          }
        />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}
