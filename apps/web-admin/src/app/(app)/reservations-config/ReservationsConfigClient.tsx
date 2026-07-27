"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FlaskConical,
  Lock,
  Phone,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Workflow,
} from "lucide-react";
import {
  ErrorNote,
  SaveRow,
  SectionCard,
  Switch,
} from "../enricher-config/atlas-ui";
import { getReservationsConfig, updateReservationsConfig } from "./actions";
import { CHANNELS, looksLikePhone, type ReservationsConfig } from "./catalog";

// While only phone is bookable, the stored channel shape is fixed: phone ranked,
// WhatsApp + Instagram parked. Kept out of the UI (nothing to reorder with one
// live channel) but written on every save so the Enricher never seeds a channel
// the agent can't yet call.
const PHONE_ONLY_CHANNELS = {
  priority: ["phone", "whatsapp", "instagram"] as ReservationsConfig["priority"],
  disabled: ["whatsapp", "instagram"] as ReservationsConfig["disabled"],
};

const STEPS = [
  "A guest taps Reserve in the app and sets the details — date & time, party size, occasion, a note.",
  "A Supabase function takes the request and briefs the Reservationist, an ElevenLabs voice agent, with the venue and the guest's parameters.",
  "The agent phones the place over Twilio and books the table, speaking naturally.",
  "It retries on the schedule below until it holds a table or runs out of attempts — then the guest's reservation flips from Pending to Confirmed.",
];

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

  // Re-fetch on mount so a client-side nav to the page shows the live row, not a
  // stale server render. On failure we keep the initial/default config usable.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getReservationsConfig();
      if (!active || !r.ok) return;
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const testInvalid =
    cfg.testCall.enabled && !looksLikePhone(cfg.testCall.number);
  // Consumer test number is optional ('' = unset) but must be E.164 when present.
  const consumerTestInvalid =
    cfg.testCall.consumerNumber.trim() !== "" &&
    !looksLikePhone(cfg.testCall.consumerNumber);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = (next: Partial<ReservationsConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
  };

  const save = () => {
    setError(null);
    // Force the phone-only channel shape — the section above is read-only, but the
    // stored blob must stay a valid, phone-first policy for the Enricher.
    const payload: ReservationsConfig = {
      ...cfg,
      ...PHONE_ONLY_CHANNELS,
      testCall: {
        enabled: cfg.testCall.enabled,
        number: cfg.testCall.number.trim(),
        consumerNumber: cfg.testCall.consumerNumber.trim(),
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

  return (
    <div className="space-y-6">
      {/* How it works — the shape of the agent, so the knobs below have context. */}
      <SectionCard
        icon={<Bot className="text-secondary h-4 w-4" />}
        title="How a reservation happens"
        subtitle="The Reservationist is a voice agent, not a form. A Supabase function briefs it and it calls the venue on the guest's behalf."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
          ) : null
        }
      >
        <ol className="mt-5 space-y-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="bg-secondary/10 text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                {i + 1}
              </span>
              <p className="text-foreground/90 text-sm leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground mt-4 border-t border-border/60 pt-3 text-xs">
          A reservation is its own ticket — booking only, no discount. It’s tracked
          separately from a guest’s reward coupons; the two never share a record.
        </p>
      </SectionCard>

      {/* Test mode — while we're not ringing real venues, the agent calls one
          fixed test number for every reservation. */}
      <SectionCard
        icon={<FlaskConical className="text-secondary h-4 w-4" />}
        title="Test mode"
        subtitle="While test mode is on, every reservation call dials the test number below instead of the place's real line — whichever venue the guest booked. So we can run the whole flow end to end without ringing a single business."
      >
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Test mode</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {cfg.testCall.enabled
                ? "On — the agent ignores each place's real phone and dials the test number below. Keep this on until we're ready to call real venues."
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
              venue&apos;s line: the only number the agent dials while test mode
              is on, and the Playground&apos;s “test number” option on the
              business side.
            </span>
          )}
        </label>

        <label className="mt-4 flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Phone className="text-muted-foreground h-4 w-4" />
            Consumer test number
          </span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+52 1 55 1234 5678"
            value={cfg.testCall.consumerNumber}
            disabled={pending}
            onChange={(e) =>
              patch({
                testCall: { ...cfg.testCall, consumerNumber: e.target.value },
              })
            }
            className="border-border bg-card focus:border-foreground h-9 w-full max-w-sm rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
          />
          {consumerTestInvalid ? (
            <span className="text-xs text-amber-600">
              Enter an E.164 number — a leading + and country code — or leave it
              empty.
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              Stands in for the guest: the callback number the Playground puts in
              a call brief when the consumer side is set to “test number”. Only
              used by the Playground — the real reservation flow never reads it.
            </span>
          )}
        </label>
      </SectionCard>

      {/* Call attempts — fixed by protocol, shown only so the number is never a mystery. */}
      <SectionCard
        icon={<RotateCcw className="text-secondary h-4 w-4" />}
        title="Call attempts"
        subtitle="Fixed by protocol — two attempts per reservation, then the guest is told the venue couldn't be reached. Not configurable."
      >
        <div className="border-border bg-card mt-5 inline-flex items-center gap-3 rounded-xl border px-4 py-3">
          <RotateCcw className="text-muted-foreground h-4 w-4" />
          <span className="text-2xl font-semibold tabular-nums">2</span>
          <span className="text-muted-foreground text-xs leading-tight">
            attempts per reservation
            <br />
            fixed — not configurable
          </span>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="flex items-start gap-2 text-xs">
            <Clock className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="text-foreground font-medium">Attempt 1 is immediate</span>{" "}
              — the moment a guest taps Reserve, whatever the hour. Plenty of venues
              run a 24/7 AI receptionist, so a 3 a.m. call can still land a table.
            </span>
          </p>
          <p className="flex items-start gap-2 text-xs">
            <Clock className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="text-foreground font-medium">
                Attempt 2 waits for opening hours
              </span>{" "}
              — five minutes after the first miss if the venue is open right now,
              otherwise 30 minutes after it next opens, today or tomorrow. It waits
              on the venue’s hours, never the guest. Still no answer → the ticket
              lands unreachable and the guest is informed.
            </span>
          </p>
        </div>
      </SectionCard>

      {/* The workflow — read-only. The protocol drawn out so it's understood at a glance. */}
      <SectionCard
        icon={<Workflow className="text-secondary h-4 w-4" />}
        title="The reservation workflow"
        subtitle="Fixed protocol, read-only — how every ticket flows from intent to a table, and who calls whom. Calls continue until both sides confirm the same reservation."
      >
        <ol className="mt-5">
          <li className="relative pb-6 pl-9">
            <span className="bg-secondary/10 text-secondary absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold">
              1
            </span>
            <span className="bg-border absolute top-7 bottom-1 left-3 w-px" />
            <p className="text-sm font-medium">Intent → ticket</p>
            <p className="text-muted-foreground mt-1 text-xs">
              The guest sets place, date, hour, party size and any requests. The
              ticket is created that instant with its 8-digit reference code —
              and opening hours never block an intent: a Thursday ask at a
              Friday–Saturday venue still gets tried.
            </p>
          </li>
          <li className="relative pb-6 pl-9">
            <span className="bg-secondary/10 text-secondary absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold">
              2
            </span>
            <span className="bg-border absolute top-7 bottom-1 left-3 w-px" />
            <p className="text-sm font-medium">
              The Booker calls the venue{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · consumer → business
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              The two attempts above. On the call it requests the table, reads the
              details back, leaves the guest’s number — and hangs up only once the
              call is solved. It comes back with one of:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                confirmed
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                counter-offer
              </span>
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                declined
              </span>
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                unreachable
              </span>
            </div>
          </li>
          <li className="relative pb-6 pl-9">
            <span className="bg-secondary/10 text-secondary absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold">
              3
            </span>
            <span className="bg-border absolute top-7 bottom-1 left-3 w-px" />
            <p className="text-sm font-medium">
              The Confirmer reaches the guest{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · business → consumer
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              By default the guest gets a call explaining the outcome; with the
              app-only preference the ticket just updates silently in the consumer
              app. A counter-offer — “outside only at 10, inside at 9” — is put to
              the guest, and their pick triggers a fresh Booker call to the venue.
              Two negotiation rounds max, then the ticket parks in the app for the
              guest to decide.
            </p>
          </li>
          <li className="relative pl-9">
            <span className="bg-secondary/10 text-secondary absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-medium">Both sides confirmed</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Calls keep happening only while the two sides disagree. The moment
              venue and guest match, the ticket closes confirmed — otherwise it
              lands declined, unreachable or cancelled, and the guest always ends
              up informed.
            </p>
          </li>
        </ol>
        <div className="mt-5 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="flex items-start gap-2 text-xs">
            <Smartphone className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="text-foreground font-medium">Anytime</span> — the
              guest can edit or cancel the ticket in the mobile app; that supersedes
              any pending call.
            </span>
          </p>
          <p className="flex items-start gap-2 text-xs">
            <PhoneCall className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="text-foreground font-medium">Future</span> — inbound
              lines for guests and venues (agents 3 and 4), callers auto-verified
              by phone number against the Mesita database.
            </span>
          </p>
        </div>
      </SectionCard>

      {/* Channels — phone live, the rest held for verified partners. */}
      <SectionCard
        icon={<CalendarCheck className="text-secondary h-4 w-4" />}
        title="Booking channels"
        subtitle="The contact the agent books through. Today that's the phone, for every place. WhatsApp and Instagram are held for verified partners."
      >
        <ul className="mt-5 space-y-2">
          {CHANNELS.map((ch) => {
            const live = ch.status === "live";
            return (
              <li
                key={ch.key}
                className={
                  "border-border bg-card flex items-center gap-3 rounded-2xl border p-3 " +
                  (live ? "" : "opacity-60")
                }
              >
                <span className="text-lg" aria-hidden>
                  {ch.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{ch.label}</span>
                    {live ? (
                      <span className="bg-secondary/10 text-secondary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        live
                      </span>
                    ) : (
                      <span className="text-muted-foreground bg-muted inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        <Lock className="h-2.5 w-2.5" />
                        coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">{ch.blurb}</p>
                  <p className="text-muted-foreground/70 mt-0.5 font-mono text-[10px]">
                    {ch.source}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          99% of places are booked by phone. WhatsApp and Instagram unlock per-venue
          for verified partners from the business console — they don’t switch on
          here, and the agent never falls back to them on its own.
        </p>
      </SectionCard>

      {/* Operator overrides — kept from the endpoint-selection era; still governs
          re-enrich of a hand-picked phone. */}
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

      <div>
        <p className="text-muted-foreground text-xs">
          Channel selection is enforced live by the Enricher contents stage
          (supabase-cron-enrich-place-contents). The test number and attempt count
          are read by the reservation agent when it places a call.
        </p>
        <SaveRow
          pending={pending}
          dirty={dirty && !testInvalid && !consumerTestInvalid}
          ok={ok}
          onClick={save}
        />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}
