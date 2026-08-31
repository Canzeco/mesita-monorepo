"use client";

// THE TICKET v4 — the presentational step bodies (MESITA-1088 · 1092).
// Pure props in, taps out: every money number arrives computed (the ONE
// amount-due formula lives server-side and in TicketScreen's mirror of it),
// and no component here talks to the network. Layout and copy follow the
// Lovable mock, tokenised to shipped Mesita tokens.

import { useMemo, useState } from "react";
import {
  Check,
  CreditCard,
  Gift,
  Loader2,
  PartyPopper,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TicketHero } from "@/components/consumer/rewards/TicketHero";
import { formatCurrency } from "@/lib/api/profile";
import { cn } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

// ── Shared receipt row (mock `Row`): one bordered line, label left, number
//    right. Every surface that shows a total builds from these. ────────────
export function MoneyRow({
  label,
  value,
  sub,
  dim = false,
}: {
  label: string;
  value: string;
  sub?: string;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
        dim && "opacity-60",
      )}
    >
      <span className="text-muted-foreground min-w-0 text-xs">
        <span className="block truncate">{label}</span>
        {sub ? (
          <span className="text-muted-foreground/80 type-meta block leading-snug">
            {sub}
          </span>
        ) : null}
      </span>
      <span className="text-foreground type-body shrink-0 font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ── F3 — the tip-honesty sentence. Permanent line items, never a tooltip:
//    it renders under every receipt that shows a payable number, so it is
//    impossible to reach the total without having been told. ───────────────
export function TipHonesty({
  subtotalCents,
  tipPct,
  past = false,
}: {
  subtotalCents: number;
  /** null = custom peso amount (no percentage basis exists). */
  tipPct: number | null;
  past?: boolean;
}) {
  if (subtotalCents <= 0) return null;
  const amount = formatCurrency(subtotalCents);
  return (
    <p className="text-muted-foreground px-1 text-center text-xs leading-snug">
      {tipPct === null
        ? "Your discount never comes out of your server's tip."
        : past
          ? `Your server was tipped on the full ${amount}.`
          : `Your server is tipped on the full ${amount}, not the discounted total. Your discount never comes out of their tip.`}
    </p>
  );
}

// ── Step 1 — Bill. The guest types the printed total and picks the tip:
//    10 / 15 / 20 / Custom, 15% preselected, amounts in pesos, always
//    computed on the bill BEFORE the discount (C4). ────────────────────────
export const TIP_PRESETS = [10, 15, 20] as const;
export const DEFAULT_TIP_PCT = 15;

/** Mirror of the server's tip formula (C4-1/2) for the live preview only —
 *  the EF recomputes and its number is the one that binds. */
export function previewTipCents(subtotalCents: number, pct: number): number {
  return Math.round((subtotalCents * pct) / 10000) * 100;
}

export function StepBill({
  initialSubtotalCents,
  initialTipPct,
  initialTipCents,
  busy,
  error,
  fixActive = false,
  tipEnabled = true,
  tipPresets = [...TIP_PRESETS],
  defaultTipPct = DEFAULT_TIP_PCT,
  onSave,
}: {
  initialSubtotalCents: number | null;
  /** undefined = never billed (preselect default); null = custom amount. */
  initialTipPct: number | null | undefined;
  initialTipCents: number | null;
  busy: boolean;
  error: string | null;
  /** Staff sent the bill back — the CTA names the resend. */
  fixActive?: boolean;
  tipEnabled?: boolean;
  tipPresets?: number[];
  defaultTipPct?: number;
  onSave: (bill: {
    subtotalCents: number;
    tipPct: number | null;
    tipCustomCents: number;
  }) => void;
}) {
  const [billDraft, setBillDraft] = useState(
    initialSubtotalCents && initialSubtotalCents > 0
      ? String(Math.round(initialSubtotalCents / 100))
      : "",
  );
  const [pct, setPct] = useState<number | null>(
    !tipEnabled
      ? 0
      : initialTipPct === undefined
        ? defaultTipPct
        : initialTipPct,
  );
  const [tipDraft, setTipDraft] = useState(
    initialTipPct === null && initialTipCents
      ? String(Math.round(initialTipCents / 100))
      : "",
  );

  const subtotalCents = useMemo(() => {
    const pesos = Number(billDraft.replace(/[,$\s]/g, ""));
    return Number.isFinite(pesos) && pesos > 0 ? Math.round(pesos * 100) : 0;
  }, [billDraft]);
  const customCents = useMemo(() => {
    const pesos = Number(tipDraft.replace(/[,$\s]/g, ""));
    return Number.isFinite(pesos) && pesos >= 0 ? Math.round(pesos * 100) : 0;
  }, [tipDraft]);
  const tipCents =
    pct === null ? customCents : previewTipCents(subtotalCents, pct);

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-card rounded-2xl border p-3.5">
        <p className="font-display text-foreground text-base leading-tight font-bold">
          What&apos;s the bill?
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          The tip is taken on the bill, before anything else.
        </p>

        <label
          htmlFor="ticket-bill"
          className="text-muted-foreground type-meta mt-3 block font-bold tracking-[0.12em] uppercase"
        >
          Bill total
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground type-body font-bold">MX$</span>
          <input
            id="ticket-bill"
            inputMode="decimal"
            autoFocus
            value={billDraft}
            onChange={(e) => setBillDraft(e.target.value)}
            placeholder="850"
            className="border-border bg-background focus:border-primary min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm font-bold tabular-nums outline-none"
          />
        </div>
        <p className="text-muted-foreground/80 type-meta mt-1">
          The printed total, before your discount.
        </p>

        {tipEnabled ? (
          <>
            <p className="text-muted-foreground type-meta mt-3 font-bold tracking-[0.12em] uppercase">
              Tip
            </p>
            <div
              className="mt-1 grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${tipPresets.length + 1}, minmax(0, 1fr))`,
              }}
            >
              {tipPresets.map((p) => {
                const on = pct === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPct(p)}
                    aria-pressed={on}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-bold transition-colors",
                      on
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {p}%
                    <span className="text-muted-foreground type-meta font-semibold tabular-nums">
                      {formatCurrency(previewTipCents(subtotalCents, p))}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPct(null)}
                aria-pressed={pct === null}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-bold transition-colors",
                  pct === null
                    ? "border-primary bg-primary/8 text-primary"
                    : "border-border bg-card text-foreground",
                )}
              >
                Custom
              </button>
            </div>
            {pct === null ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-muted-foreground type-body font-bold">
                  MX$
                </span>
                <input
                  inputMode="decimal"
                  value={tipDraft}
                  onChange={(e) => setTipDraft(e.target.value)}
                  placeholder="0"
                  aria-label="Custom tip in pesos"
                  className="border-border bg-background focus:border-primary min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm font-bold tabular-nums outline-none"
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {subtotalCents > 0 ? (
        <div className="flex flex-col gap-1.5">
          <MoneyRow label="Bill" value={formatCurrency(subtotalCents)} />
          <MoneyRow
            label={pct === null ? "Tip" : `Tip · ${pct}%`}
            sub={
              pct === null
                ? "Your amount"
                : `${pct}% of ${formatCurrency(subtotalCents)}, before the discount`
            }
            value={formatCurrency(tipCents)}
          />
          <MoneyRow
            label="Subtotal"
            value={formatCurrency(subtotalCents + tipCents)}
          />
        </div>
      ) : null}

      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}

      <Button
        type="button"
        size="lg"
        disabled={subtotalCents <= 0 || busy}
        onClick={() =>
          onSave({ subtotalCents, tipPct: pct, tipCustomCents: customCents })
        }
        className="shadow-glow w-full text-sm font-bold disabled:opacity-45 disabled:shadow-none"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {subtotalCents <= 0
          ? "Enter the bill to continue"
          : fixActive
            ? "Send the corrected bill"
            : "Save the bill"}
      </Button>

      <TipHonesty subtotalCents={subtotalCents} tipPct={pct} />
    </div>
  );
}

// ── Step 5 — Pay. Only reachable once the place approved: the last moment
//    anything can change the amount. ONE live path: the guest pays the place
//    directly.
//
//    Mesita Pay (the card rail) is STAGED, not retired: the Connect account
//    layer landed in #1415 and the guest's saved cards live in Me › More ›
//    Cards. What is missing is the charge path, so its row renders `soon`.
//    It appears ONLY when the server says this ticket's place is pay-ready —
//    places.mesita_pay_enabled ∧ visits_config.payCard ∧ Connect
//    charge-readiness, resolved in consumer-web-get-ticket and arriving as
//    one derived boolean. All three are false in production today, so the
//    floor sees exactly what it saw yesterday.
//
//    Credits stay parked: they cover the bill, never the tip, and settle as a
//    REDUCTION rather than a payment method. ────────────────────────────────
export function StepPay({
  placeName,
  pct,
  subtotalCents,
  tipCents,
  tipPct,
  discountCents,
  amountDueCents,
  busy,
  error,
  cardRailAvailable = false,
  onConfirmAtPlace,
}: {
  placeName: string;
  pct: number;
  subtotalCents: number;
  tipCents: number;
  tipPct: number | null;
  discountCents: number;
  amountDueCents: number;
  busy: boolean;
  error: string | null;
  /** Server-derived three-leg pay-readiness for this ticket's place. */
  cardRailAvailable?: boolean;
  onConfirmAtPlace: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.06] p-3.5">
        <p className="font-display text-foreground text-base leading-tight font-bold">
          {placeName} approved it
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {pct > 0 ? `${pct}% off is locked. ` : ""}Pay at the table like always
          — the ticket closes the moment they confirm.
        </p>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="border-border bg-muted/40 border-b px-3.5 py-2">
          <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
            How you settle
          </span>
        </div>
        <div className="divide-border/60 divide-y">
          <PayMethodRow
            icon={<Wallet className="text-muted-foreground size-4" />}
            label="At the register"
            sub="Cash or card, straight to the place"
            selected
          />
        </div>
        {cardRailAvailable ? (
          <>
            <div className="border-border bg-muted/40 border-y px-3.5 py-2">
              <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
                Mesita Pay
              </span>
            </div>
            <PayMethodRow
              icon={<CreditCard className="text-muted-foreground size-4" />}
              label="Pay with my card"
              sub="Coming soon · settle the bill from your saved card"
              soon
            />
          </>
        ) : null}
        <div className="border-border bg-muted/40 border-y px-3.5 py-2">
          <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
            Your Credits
          </span>
        </div>
        <PayMethodRow
          icon={<Gift className="text-muted-foreground size-4" />}
          label="Spend my Credits on this"
          sub="Coming soon · covers the bill, never the tip"
          soon
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <MoneyRow label="Bill" value={formatCurrency(subtotalCents)} />
        <MoneyRow
          label={`Discount · ${pct}%`}
          value={`− ${formatCurrency(discountCents)}`}
        />
        <MoneyRow
          label="Tip (100% to the place)"
          value={formatCurrency(tipCents)}
        />
        <MoneyRow
          label="You pay at the table"
          value={formatCurrency(amountDueCents)}
        />
      </div>

      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}

      <Button
        type="button"
        size="lg"
        disabled={busy}
        onClick={onConfirmAtPlace}
        className="shadow-glow w-full text-sm font-bold disabled:opacity-45"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        I&apos;m paying {formatCurrency(amountDueCents)} at the register
      </Button>

      <TipHonesty subtotalCents={subtotalCents} tipPct={tipPct} />
    </div>
  );
}

function PayMethodRow({
  icon,
  label,
  sub,
  selected = false,
  soon = false,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  selected?: boolean;
  soon?: boolean;
}) {
  return (
    <div
      aria-disabled={soon || undefined}
      className={cn(
        "relative flex min-h-14 items-center gap-3 px-3.5 py-2.5",
        selected && "bg-primary/[0.06]",
        soon && "opacity-50",
      )}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="bg-primary absolute inset-y-0 left-0 w-[3px] rounded-r-full"
        />
      ) : null}
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-xl",
          selected ? "bg-primary/12" : "bg-muted/60",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground flex items-center gap-1.5 text-xs leading-tight font-bold">
          <span className="truncate">{label}</span>
          {soon ? (
            <span className="bg-muted text-muted-foreground type-meta shrink-0 rounded-full px-1.5 py-0.5 font-bold tracking-wide uppercase">
              Soon
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground type-meta mt-0.5 block truncate font-semibold">
          {sub}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[20px] shrink-0 place-items-center rounded-full border-2",
          selected
            ? "border-primary bg-primary text-white"
            : "border-border bg-background",
        )}
      >
        {selected ? (
          <span className="size-[7px] rounded-full bg-white" />
        ) : null}
      </span>
    </div>
  );
}

// ── Step 6 — Validate. Payment confirmed → the ticket validates and closes
//    on its own; the guest just watches (F1's quiet sibling). ──────────────
export function StepValidate({ placeName }: { placeName: string }) {
  return (
    <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-6 text-center">
      <span className="bg-muted/60 grid size-11 place-items-center rounded-2xl">
        <span className="border-border border-t-primary size-5 animate-spin rounded-full border-2" />
      </span>
      <p className="font-display text-foreground text-base leading-tight font-bold">
        Waiting on {placeName}
      </p>
      <p className="text-muted-foreground max-w-[300px] text-xs leading-relaxed">
        Hand over the payment — the moment they confirm it, the visit validates
        and closes on its own. Nothing left to do.
      </p>
    </div>
  );
}

// ── Step 7 — Results. What the visit paid, on the class-tinted pass. ───────
export function StepResults({
  passClassName,
  classLabel,
  placeName,
  cancelled,
  revealed,
  savedCents,
  pct,
  subtotalCents,
  tipCents,
  tipPct,
  paidCents,
  paidMethodLabel,
  capPesos,
  capApplied,
}: {
  passClassName: string;
  classLabel: string;
  placeName: string;
  cancelled: boolean;
  revealed: boolean;
  savedCents: number;
  pct: number;
  subtotalCents: number;
  tipCents: number;
  tipPct: number | null;
  paidCents: number;
  paidMethodLabel: string | null;
  capPesos: number | null;
  capApplied: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <TicketHero className={cn("px-4 pt-3.5 pb-4", passClassName)}>
        <div className="flex items-center justify-between gap-3">
          <p className="type-meta font-bold tracking-[0.14em] text-white/75 uppercase">
            Mesita Pass
          </p>
          <span className="type-meta rounded-full bg-white/22 px-2 py-0.5 font-bold tracking-widest uppercase">
            {classLabel}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 py-5 text-center">
          {revealed ? (
            <>
              <PartyPopper className="size-7" />
              <p className="font-display text-xl font-bold tabular-nums">
                {savedCents > 0
                  ? `You saved ${formatCurrency(savedCents)}`
                  : "Visit complete"}
              </p>
              <p className="text-xs text-white/90">
                {pct > 0 ? `${pct}% off at ${placeName}` : placeName}
              </p>
              {capApplied && capPesos ? (
                <p className="text-xs text-white/75">
                  Capped at MX${capPesos.toLocaleString("en-US")} off.
                </p>
              ) : null}
            </>
          ) : cancelled ? (
            <>
              <p className="text-sm font-bold">Ticket cancelled</p>
              <p className="text-xs text-white/90">
                Start a fresh one from Visit whenever you&apos;re back.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">Visit in progress</p>
              <p className="text-xs text-white/90">
                Your result lands here once {placeName} closes the visit.
              </p>
            </>
          )}
        </div>
      </TicketHero>

      {revealed && subtotalCents > 0 ? (
        <div className="flex flex-col gap-1.5">
          <MoneyRow label="Final bill" value={formatCurrency(subtotalCents)} />
          {tipCents > 0 ? (
            <MoneyRow
              label="Tip (100% to the place)"
              value={formatCurrency(tipCents)}
            />
          ) : null}
          <MoneyRow label="You paid" value={formatCurrency(paidCents)} />
          {pct > 0 ? (
            <MoneyRow label="Discount applied" value={`${pct}%`} />
          ) : null}
          {paidMethodLabel ? (
            <MoneyRow label="Settled" value={paidMethodLabel} />
          ) : null}
          {capApplied && capPesos ? (
            <p className="text-muted-foreground px-1 text-xs">
              Discount capped at MX${capPesos.toLocaleString("en-US")}.
            </p>
          ) : null}
          {tipCents > 0 ? (
            <TipHonesty subtotalCents={subtotalCents} tipPct={tipPct} past />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── The Reward step's lanes (mock `Lane`): a titled strip of chips. ────────
export function Lane({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      <div className="border-border bg-muted/40 flex items-baseline justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
          {title}
        </span>
        <span className="text-muted-foreground type-meta font-semibold">
          {note}
        </span>
      </div>
      <div className="scrollbar-hide flex gap-1 overflow-x-auto px-2 py-1.5">
        {children}
      </div>
    </section>
  );
}

export function LaneChip({
  label,
  sub,
  value,
  on = false,
  faded = false,
  done = false,
  glyph,
  onClick,
}: {
  label: string;
  sub?: string;
  /** null hides the number (a state chip, not a priced one). */
  value: number | null;
  on?: boolean;
  faded?: boolean;
  done?: boolean;
  glyph?: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {glyph ? (
        <span className="shrink-0 [&>svg]:size-3.5">{glyph}</span>
      ) : null}
      <span className="min-w-0">
        <span className="text-foreground type-meta flex items-center gap-1 leading-tight font-bold">
          <span className="truncate">{label}</span>
          {done ? (
            <Check
              className="size-2.5 shrink-0 text-emerald-600"
              strokeWidth={4}
            />
          ) : null}
        </span>
        {sub ? (
          <span className="text-muted-foreground type-meta block truncate leading-tight">
            {sub}
          </span>
        ) : null}
        {value !== null ? (
          <span
            className={cn(
              "font-display block text-xs leading-tight font-bold tabular-nums",
              on ? "text-primary" : "text-foreground",
            )}
          >
            {value > 0 ? `+${value}%` : "0%"}
          </span>
        ) : null}
      </span>
    </>
  );
  const shell = cn(
    "flex min-w-[68px] shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition",
    on ? "border-primary bg-primary/[0.08]" : "border-border bg-background",
    faded && !on && "opacity-45",
  );
  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={onClick}
        className={shell}
      >
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}
