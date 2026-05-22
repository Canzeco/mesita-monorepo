import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet as WalletIcon,
  CreditCard,
  Download,
  Calendar,
  Percent,
  Zap,
  Clock,
  Camera,
  ShieldAlert,
  Building2,
  CircleAlert,
  ArrowRightLeft,
  RefreshCcw,
} from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import {
  WALLET,
  PENDING_RELEASES,
  TRANSACTIONS,
  type StripeConnectStatus,
  type StripeTxnType,
  type StripeTxnStatus,
  type PendingReleaseReason,
} from "@/lib/manager-data";
import { cn } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/wallet`);

  const w = WALLET;
  const pendingCount = PENDING_RELEASES.length;

  return (
    <>
      <Topbar
        title="Wallet"
        subtitle="Available · pending · payouts to your bank"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <div className="border-secondary/40 bg-secondary/5 text-secondary rounded-2xl border border-dashed px-4 py-3 text-[12px]">
            Preview — wallet shows Stripe-shaped data. Real balances + payouts
            ship once Stripe Connect Express is wired up.
          </div>

          <ConnectStatusBanner status={w.connectStatus} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BalanceCard
              availableCents={w.availableCents}
              pendingCents={w.pendingCents}
              pendingCount={pendingCount}
              instantAvailableCents={w.instantAvailableCents}
              destination={w.payoutDestination}
              disabled={w.connectStatus !== "active"}
            />
            <PayoutAccountCard
              destination={w.payoutDestination}
              schedule={w.payoutSchedule}
              availableCents={w.availableCents}
              connected={w.connectStatus === "active"}
            />
          </div>

          <MonthSummary
            thisMonthNetCents={w.thisMonthNetCents}
            lifetimePayoutsCents={w.lifetimePayoutsCents}
          />

          {pendingCount > 0 && (
            <PendingReleases pendingCents={w.pendingCents} />
          )}

          <Ledger />
        </div>
      </div>
    </>
  );
}

// ── Connect onboarding banner ────────────────────────────────────────────

function ConnectStatusBanner({ status }: { status: StripeConnectStatus }) {
  if (status === "active") return null;
  const meta = {
    not_connected: {
      tone: "bg-tier-gold/15 border-tier-gold/40 text-foreground",
      Icon: CircleAlert,
      title: "Connect your bank account to receive payouts",
      body: "Mesita uses Stripe Connect Express to deposit your earnings. Setup takes about 3 minutes.",
      cta: "Connect bank account",
    },
    onboarding_pending: {
      tone: "bg-tier-gold/15 border-tier-gold/40 text-foreground",
      Icon: Clock,
      title: "Finish setting up your payout account",
      body: "Stripe needs a few more details before payouts can be enabled.",
      cta: "Continue setup",
    },
    verification_pending: {
      tone: "bg-secondary/10 border-secondary/40 text-foreground",
      Icon: Clock,
      title: "Stripe is verifying your account",
      body: "Most accounts are approved within 24 hours. Payouts will enable automatically once verification clears.",
      cta: null,
    },
    restricted: {
      tone: "bg-destructive/10 border-destructive/30 text-foreground",
      Icon: ShieldAlert,
      title: "Payouts paused",
      body: "Stripe flagged your account for review. Earnings are still being collected — they'll release once review clears.",
      cta: "View details on Stripe",
    },
  }[status];

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-4", meta.tone)}>
      <meta.Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold tracking-tight">
          {meta.title}
        </p>
        <p className="mt-0.5 text-[13px] opacity-85">{meta.body}</p>
      </div>
      {meta.cta && (
        <button className="bg-foreground text-background shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold">
          {meta.cta}
        </button>
      )}
    </div>
  );
}

// ── Hero balance card ────────────────────────────────────────────────────

function BalanceCard({
  availableCents,
  pendingCents,
  pendingCount,
  instantAvailableCents,
  destination,
  disabled,
}: {
  availableCents: number;
  pendingCents: number;
  pendingCount: number;
  instantAvailableCents: number;
  destination: string;
  disabled: boolean;
}) {
  return (
    <div className="bg-peacock shadow-glow overflow-hidden rounded-2xl p-6 text-white lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.18em] uppercase opacity-80">
            Available to withdraw
          </p>
          <p className="font-display mt-2 text-5xl leading-none font-bold tracking-tight">
            {formatMxn(availableCents)}
          </p>
          <p className="mt-2 text-[12px] opacity-85">
            {formatMxn(pendingCents)} pending across {pendingCount}{" "}
            release{pendingCount === 1 ? "" : "s"} · net of Stripe &amp;
            Mesita fees
          </p>
        </div>
        <WalletIcon className="h-10 w-10 shrink-0 opacity-30" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          disabled={disabled || availableCents === 0}
          className="text-foreground inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
        >
          <ArrowDownRight className="h-4 w-4" />
          Withdraw {formatMxn(availableCents)} to {destination}
        </button>
        {instantAvailableCents > 0 && (
          <button
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            Instant · 1.5% fee
          </button>
        )}
        <button
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export ledger
        </button>
      </div>
    </div>
  );
}

// ── Payout account sidecard ──────────────────────────────────────────────

function PayoutAccountCard({
  destination,
  schedule,
  availableCents,
  connected,
}: {
  destination: string;
  schedule: "manual" | "daily" | "weekly";
  availableCents: number;
  connected: boolean;
}) {
  const scheduleLabel = {
    manual: "Manual withdrawals · you control timing",
    daily: "Auto-payout daily · powered by Stripe",
    weekly: "Auto-payout every Monday · powered by Stripe",
  }[schedule];

  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        Payout account
      </p>
      <div className="mt-2 flex items-center gap-2">
        <CreditCard className="text-secondary h-5 w-5" />
        <p className="font-display text-lg font-semibold tracking-tight">
          {destination}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-[12px]">{scheduleLabel}</p>
      {connected ? (
        <div className="border-border bg-background mt-4 rounded-xl border p-3 text-sm">
          <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            Next auto-payout
          </p>
          <p className="mt-1 font-medium">
            Monday · {formatMxn(availableCents)}
          </p>
        </div>
      ) : (
        <div className="border-border bg-background mt-4 rounded-xl border border-dashed p-3 text-[12px]">
          <p className="text-muted-foreground">
            No account connected yet. Earnings hold on Mesita&apos;s platform
            balance until you connect a bank.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Month / lifetime summary ─────────────────────────────────────────────

function MonthSummary({
  thisMonthNetCents,
  lifetimePayoutsCents,
}: {
  thisMonthNetCents: number;
  lifetimePayoutsCents: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SummaryChip
        label="This month · net"
        value={formatMxn(thisMonthNetCents)}
        Icon={Calendar}
        sub="After Stripe + Mesita fees"
      />
      <SummaryChip
        label="Lifetime paid out"
        value={formatMxn(lifetimePayoutsCents)}
        Icon={Building2}
        sub="Settled to your bank"
      />
    </div>
  );
}

function SummaryChip({
  label,
  value,
  Icon,
  sub,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  sub: string;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
          {label}
        </p>
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <p className="font-display mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[12px]">{sub}</p>
    </div>
  );
}

// ── Pending releases ─────────────────────────────────────────────────────

function PendingReleases({ pendingCents }: { pendingCents: number }) {
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
          Pending releases
        </p>
        <p className="text-muted-foreground text-[12px] tabular-nums">
          {formatMxn(pendingCents)} held
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-[12px]">
        Funds held on Mesita&apos;s platform balance until each release condition
        clears. Cashback waits for an Instagram story to validate; non-story
        charges wait out a 7-day chargeback window.
      </p>
      <ul className="border-border mt-3 divide-y">
        {PENDING_RELEASES.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <ReasonIcon reason={r.reason} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.ticketLabel}</p>
              <p className="text-muted-foreground text-[12px]">
                Releases {r.releasesIn}
              </p>
            </div>
            <p className="text-foreground text-sm font-semibold tabular-nums">
              {formatMxn(r.amountCents)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReasonIcon({ reason }: { reason: PendingReleaseReason }) {
  const meta = {
    story_pending: {
      Icon: Camera,
      tone: "bg-secondary/15 text-secondary",
    },
    dispute_window: {
      Icon: Clock,
      tone: "bg-tier-gold/30 text-foreground",
    },
    stripe_review: {
      Icon: ShieldAlert,
      tone: "bg-muted text-muted-foreground",
    },
  }[reason];
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        meta.tone,
      )}
    >
      <meta.Icon className="h-4 w-4" />
    </span>
  );
}

// ── Ledger table ─────────────────────────────────────────────────────────

function Ledger() {
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
          Ledger
        </p>
        <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
          <Calendar className="h-3.5 w-3.5" />
          Last 30 days
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-muted-foreground text-left text-[10px] tracking-wider uppercase">
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Gross</th>
              <th className="py-2 text-right font-medium">Fee</th>
              <th className="py-2 text-right font-medium">Net</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {TRANSACTIONS.map((t) => (
              <tr key={t.id} className="border-border border-t text-sm">
                <td className="py-2.5">
                  <TypeBadge type={t.type} />
                </td>
                <td className="py-2.5">
                  <p className="font-medium">{t.label}</p>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    {t.stripeObjectId}
                  </p>
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {signedMxn(t.grossCents)}
                </td>
                <td className="text-muted-foreground py-2.5 text-right tabular-nums">
                  {t.feeCents === 0 ? "—" : signedMxn(t.feeCents)}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">
                  {signedMxn(t.netCents)}
                </td>
                <td className="py-2.5">
                  <StatusBadge status={t.status} />
                </td>
                <td className="text-muted-foreground py-2.5 text-right">
                  {t.when}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: StripeTxnType }) {
  const meta = {
    charge: {
      Icon: ArrowUpRight,
      label: "Charge",
      tone: "bg-secondary/15 text-secondary",
    },
    refund: {
      Icon: RefreshCcw,
      label: "Refund",
      tone: "bg-destructive/10 text-destructive",
    },
    transfer: {
      Icon: ArrowRightLeft,
      label: "Transfer",
      tone: "bg-muted text-muted-foreground",
    },
    payout: {
      Icon: ArrowDownRight,
      label: "Payout",
      tone: "bg-tier-gold/30 text-foreground",
    },
    fee: {
      Icon: Percent,
      label: "Fee",
      tone: "bg-muted text-muted-foreground",
    },
    adjustment: {
      Icon: ShieldAlert,
      label: "Adjustment",
      tone: "bg-muted text-muted-foreground",
    },
  }[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        meta.tone,
      )}
    >
      <meta.Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: StripeTxnStatus }) {
  const meta = {
    pending: { label: "Pending", tone: "bg-tier-gold/30 text-foreground" },
    available: {
      label: "Available",
      tone: "bg-secondary/15 text-secondary",
    },
    in_transit: {
      label: "In transit",
      tone: "bg-secondary/10 text-secondary",
    },
    paid: { label: "Paid", tone: "bg-muted text-muted-foreground" },
    refunded: {
      label: "Refunded",
      tone: "bg-destructive/10 text-destructive",
    },
    failed: {
      label: "Failed",
      tone: "bg-destructive/10 text-destructive",
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        meta.tone,
      )}
    >
      {meta.label}
    </span>
  );
}

// ── Local money formatters ───────────────────────────────────────────────
//
// Amounts in `manager-data` are MXN centavos (1/100 of a peso) to match
// what Stripe will return on BalanceTransaction. Display strips the
// minor units for readability — the table headers carry the implied
// currency. When the real Stripe integration lands these should move
// into a shared `lib/format.ts` so guest + admin surfaces use the same
// rounding rules.

function formatMxn(cents: number): string {
  const pesos = Math.round(cents / 100);
  return `MX$${Math.abs(pesos).toLocaleString()}`;
}

function signedMxn(cents: number): string {
  const sign = cents >= 0 ? "+" : "−";
  return `${sign}${formatMxn(cents)}`;
}
