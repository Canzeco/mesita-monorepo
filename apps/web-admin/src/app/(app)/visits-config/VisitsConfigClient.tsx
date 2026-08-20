"use client";

// Visits Config — the local context's policy. WHOLE-BLOB save (the tip
// preselection and the poll pair are related sets), `dirty` gates on loadError
// so a failed read can never overwrite the live singleton (MESITA-737), and
// every knob carries a STAGED badge because the apps still run these values as
// hardcoded constants. House rule: an unenforced config is a bug — a staged
// one has to say so out loud.

import { useState, useTransition } from "react";
import {
  Armchair,
  Banknote,
  Camera,
  Clock,
  Coins,
  CreditCard,
  Cookie,
  Flag,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { getVisitsConfig, updateVisitsConfig } from "./actions";
import type { VisitsConfig } from "./defaults";

function StagedBadge() {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      Staged
    </span>
  );
}

const PAY_RAILS: {
  key: "payCash" | "payCard" | "payYums";
  label: string;
  blurb: string;
  Icon: typeof Banknote;
}[] = [
  {
    key: "payCash",
    label: "At the place",
    Icon: Banknote,
    blurb:
      "Cash at the register, or however the place already charges. The one live path today — Mesita moves no money at the table, so the discount is applied and the guest settles the rest with the venue.",
  },
  {
    key: "payCard",
    label: "Card through Mesita",
    Icon: CreditCard,
    blurb:
      "Mesita takes the payment. Staged chrome on the Pay step: turning it on before the rail exists shows the guest a button that cannot settle anything.",
  },
  {
    key: "payYums",
    label: "Yums (Credits)",
    Icon: Cookie,
    blurb:
      "Credits cover the bill after the discount resolves — never the tip, which is always real money to the waiter. Stage-gated with the whole Credits program.",
  },
];

export function VisitsConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: VisitsConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<VisitsConfig>(initialConfig);
  const [saved, setSaved] = useState<VisitsConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  const patch = (p: Partial<VisitsConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, ...p }));
  };

  const setPreset = (index: number, value: number) => {
    setOk(false);
    setCfg((c) => {
      const next = [...c.tipPresets];
      next[index] = Math.round(value);
      return { ...c, tipPresets: next };
    });
  };

  // Reported, never auto-corrected — the Filters Config rule. Both are savable
  // states that simply cannot serve a guest.
  const noRail =
    !cfg.payCash && !cfg.payCard && !cfg.payYums
      ? "No pay rail is open — a guest would reach the Pay step with nothing to choose."
      : null;
  const defaultOffPresets = !cfg.tipPresets.includes(cfg.defaultTipPct)
    ? "The preselected tip is not one of the chips offered; saving snaps it to the lowest."
    : null;

  const save = () => {
    setError(null);
    startTransition(async () => {
      const presets = [...new Set(cfg.tipPresets.map(Math.round))].sort(
        (a, b) => a - b,
      );
      const next: VisitsConfig = {
        ...cfg,
        tipPresets: presets,
        defaultTipPct: presets.includes(cfg.defaultTipPct)
          ? cfg.defaultTipPct
          : presets[0],
        staffPollMaxSeconds: Math.max(
          cfg.staffPollSeconds,
          cfg.staffPollMaxSeconds,
        ),
      };
      const r = await updateVisitsConfig(next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOk(true);
    });
  };

  const reload = () => {
    setError(null);
    startTransition(async () => {
      const r = await getVisitsConfig();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOk(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Coins className="h-4 w-4" />}
        title="The bill step"
        subtitle="What the guest is offered when they type the bill. The tip always rides the PRE-discount amount — that is an invariant, not a knob."
        status={<StagedBadge />}
      >
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Offer a tip</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Off hides the chips entirely and the bill is just the bill. The
              tip is never Mesita&rsquo;s money — it reaches the place in full,
              on its own rail.
            </p>
          </div>
          <Switch
            on={cfg.tipEnabled}
            pending={pending}
            onClick={() => patch({ tipEnabled: !cfg.tipEnabled })}
            label="Offer a tip"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {cfg.tipPresets.map((p, i) => (
            <NumberField
              key={i}
              icon={<Coins className="h-4 w-4" />}
              label={`Chip ${i + 1} (%)`}
              value={p}
              min={0}
              max={100}
              disabled={pending || !cfg.tipEnabled}
              onChange={(v) => setPreset(i, v)}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Coins className="h-4 w-4" />}
            label="Preselected (%)"
            value={cfg.defaultTipPct}
            min={0}
            max={100}
            disabled={pending || !cfg.tipEnabled}
            onChange={(v) => patch({ defaultTipPct: Math.round(v) })}
          />
        </div>
        {defaultOffPresets ? (
          <p className="border-border bg-muted/40 text-muted-foreground mt-3 rounded-xl border border-dashed p-3 text-xs leading-relaxed">
            {defaultOffPresets}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        icon={<RefreshCw className="h-4 w-4" />}
        title="Live sync"
        subtitle="Both sides POLL — Supabase Realtime stays off tickets by decision, and that is not revisited here."
        status={<StagedBadge />}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            icon={<RefreshCw className="h-4 w-4" />}
            label="Guest interval (s)"
            value={cfg.consumerPollSeconds}
            min={2}
            max={120}
            disabled={pending}
            onChange={(v) => patch({ consumerPollSeconds: Math.round(v) })}
          />
          <NumberField
            icon={<RefreshCw className="h-4 w-4" />}
            label="Staff interval (s)"
            value={cfg.staffPollSeconds}
            min={1}
            max={120}
            disabled={pending}
            onChange={(v) => patch({ staffPollSeconds: Math.round(v) })}
          />
          <NumberField
            icon={<Clock className="h-4 w-4" />}
            label="Staff backoff cap (s)"
            value={cfg.staffPollMaxSeconds}
            min={1}
            max={600}
            disabled={pending}
            onChange={(v) => patch({ staffPollMaxSeconds: Math.round(v) })}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          The staff side polls fastest on purpose: approve is compare-and-swap
          against the guest&rsquo;s last write, so a stale render disables the
          button. Slowing it down doesn&rsquo;t save much and does strand
          waiters. Saving clamps the cap up to the base interval.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Camera className="h-4 w-4" />}
        title="Tasks and send-backs"
        subtitle="The guest's work happens BEFORE the business is involved; staff never adjudicate a proof."
        status={<StagedBadge />}
      >
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">A screenshot is required</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              The story and review tasks upload a screenshot as the audit
              artifact. The web UI already demands one while the Edge Function
              still accepts a task without it — this knob is where that
              disagreement gets settled, and Ojo has nothing to read if it is
              off.
            </p>
          </div>
          <Switch
            on={cfg.requireProofScreenshot}
            pending={pending}
            onClick={() =>
              patch({ requireProofScreenshot: !cfg.requireProofScreenshot })
            }
            label="Require a screenshot"
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Undo2 className="h-4 w-4" />}
            label="Send-backs per ticket"
            value={cfg.maxFixRequests}
            min={0}
            max={10}
            disabled={pending}
            onChange={(v) => patch({ maxFixRequests: Math.round(v) })}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          A send-back is ONE named fix on the same code — no new QR, no
          renegotiation. Two is room for an honest mistake; a ticket needing a
          third has a problem the floor should settle in person.
        </p>
      </SectionCard>

      <SectionCard
        icon={<CreditCard className="h-4 w-4" />}
        title="Pay rails"
        subtitle="How the guest settles once staff have approved. One is live; two are staged chrome."
        status={<StagedBadge />}
      >
        <div className="flex flex-col gap-3">
          {PAY_RAILS.map((r) => (
            <div
              key={r.key}
              className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <r.Icon className="h-4 w-4 shrink-0" />
                  {r.label}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {r.blurb}
                </p>
              </div>
              <Switch
                on={cfg[r.key]}
                pending={pending}
                onClick={() =>
                  patch({ [r.key]: !cfg[r.key] } as Partial<VisitsConfig>)
                }
                label={r.label}
              />
            </div>
          ))}
        </div>
        {noRail ? (
          <p className="border-border bg-muted/40 text-muted-foreground mt-3 rounded-xl border border-dashed p-3 text-xs leading-relaxed">
            {noRail}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        icon={<Armchair className="h-4 w-4" />}
        title="Lifecycle"
        subtitle="What happens to a ticket nobody finished, and the two routes that outlive the journey."
        status={<StagedBadge />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Clock className="h-4 w-4" />}
            label="Abandon after (hours)"
            value={cfg.autoCloseHours}
            min={1}
            max={720}
            disabled={pending}
            onChange={(v) => patch({ autoCloseHours: Math.round(v) })}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          A ticket nobody validated is abandoned, not disputed — long enough to
          survive a slow table, short enough that the wallet is not a graveyard.
        </p>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">The legacy v3 path</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Unbilled v3 tickets still ride `check-web-submit-bill` and
              `check-web-mark-paid`. Turning this off retires the pair — safe
              only once no old ticket can still arrive at a table.
            </p>
          </div>
          <Switch
            on={cfg.legacyV3Enabled}
            pending={pending}
            onClick={() => patch({ legacyV3Enabled: !cfg.legacyV3Enabled })}
            label="Legacy v3 path"
          />
        </div>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Flag className="h-4 w-4 shrink-0" />
              The report route
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Rides the whole life of the ticket, so a refused discount has
              somewhere to go that isn&rsquo;t the staff standing in front of
              the guest. Off leaves that argument at the table.
            </p>
          </div>
          <Switch
            on={cfg.reportEnabled}
            pending={pending}
            onClick={() => patch({ reportEnabled: !cfg.reportEnabled })}
            label="Report route"
          />
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadError}
      />

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={reload}
          disabled={pending}
          className="hover:text-foreground underline underline-offset-2 disabled:opacity-50"
        >
          Reload
        </button>
        {updatedAt ? (
          <span>Last saved {new Date(updatedAt).toLocaleString()}</span>
        ) : null}
      </div>
    </div>
  );
}
