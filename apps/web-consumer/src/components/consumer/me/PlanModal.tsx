"use client";

// Me › Plan (/me/plan). SOLD AGAIN (Pato, 2026-11-14, MESITA-3870: "Add the
// Plan again. 2 Reservations per month is Free. 10 Reservations per month if
// Pro. thats it. and make it 2 dollar per month. Easy peasy."):
//
// Then $1 and "Max" (MESITA-3881), then a usage bar over two plan cards
// (MESITA-3899, /plan-design-review "Better design for Free and Pro"):
//
//   ┌ 1 of 2 reservations used ──────┐   red and "Limit reached this
//   │ ████████░░░░░░░░               │   month · N used" at or over
//   │ Resets Dec 1                   │
//   └────────────────────────────────┘
//   ┌ Free  Current             Free ┐
//   │ ✓ Max 2 reservations a month   │
//   └────────────────────────────────┘
//   ┏ Pro            $1 USD a month ┓   2px ink border
//   ┃ ✓ Max 10 reservations a month  ┃
//   ┃ ✓ MCP for ChatGPT or Claude Soon┃
//   ┃ [ Upgrade to Pro ]              ┃  Free guests
//   ┃ Renews Dec 14 · Cancel Pro      ┃  paid Pro
//   ┃ Ends Dec 14 · [ Keep Pro ]      ┃  cancelled Pro
//   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
//
// One capability, nothing else (Pato: "only that capability for the moment").
// The server decides it all (consumer-web-get-plan, -start-plan,
// -cancel-plan; supabase/functions/_shared/guest-plan.ts): Upgrade opens
// Stripe Checkout and comes back here with ?plan=<session>, which the read
// confirms. No Plan pill in the header (MESITA-3830 took it out; the grid's
// Plan tile is the door).
//
// Plan copy never names Class, and Class copy never names a plan (MESITA-2553).

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  PLAN_ROWS,
  type PlanRowWords,
} from "@/components/consumer/me/plan-words";
import { EFError } from "@/lib/api/_invoke";
import {
  apiCancelPlan,
  apiGetPlan,
  apiStartPlan,
  type GuestPlanView,
} from "@/lib/api/plan";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { CurrentPill, ME_BUTTON_CLASS } from "./settings-rows";

/** One plan as a card (MESITA-3899): its name with the Current pill, its
 *  price, its perks as a check list, then `children` (Pro's action). */
function PlanCard({
  words,
  current,
  featured = false,
  children,
}: {
  words: PlanRowWords;
  current: boolean;
  /** Pro: the 2px ink border and the large price. */
  featured?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-card rounded-2xl p-4",
        featured ? "border-foreground border-2" : "border-border border",
      )}
      aria-label={words.title}
      data-plan-row={words.title}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">
          {words.title}
          {current && <CurrentPill data-plan-current="" />}
        </h2>
        <span
          className={cn(
            "shrink-0",
            featured
              ? "text-lg font-semibold"
              : "text-muted-foreground text-sm",
          )}
        >
          {words.price}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          {words.perk}
        </li>
        {words.soonPerk && (
          <li className="text-muted-foreground flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {words.soonPerk}
            <span className="bg-muted text-muted-foreground type-meta rounded-full px-1.5 py-0.5 font-semibold">
              Soon
            </span>
          </li>
        )}
      </ul>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

/** The 1st of next month in Mexico City, as "Dec 1": when the monthly cap
 *  resets (reservation-cap.ts counts by Mexico City's calendar month). */
function resetDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(y, m, 1, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** This month's usage (MESITA-3899): the first card, the reason to
 *  upgrade. Ink bar; full and red at or over the cap. Empty before the read. */
function UsageCard({ view }: { view: GuestPlanView | null }) {
  const used = view?.used ?? 0;
  const cap = view?.cap ?? 0;
  const full = !!view && used >= cap;
  const ratio = view && cap > 0 ? Math.min(used / cap, 1) : full ? 1 : 0;
  return (
    <section
      className="bg-card border-border rounded-2xl border p-4"
      aria-label="This month"
      data-plan-usage
    >
      <p className="text-sm font-semibold">
        {!view
          ? "Reservations this month"
          : full
            ? `Limit reached this month · ${used} used`
            : `${used} of ${cap} reservations used`}
      </p>
      <div
        role="progressbar"
        aria-label="Reservations used this month"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={view ? used : undefined}
        className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            full ? "bg-destructive" : "bg-foreground",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="text-muted-foreground type-label mt-2">
        Resets {resetDay()}
      </p>
    </section>
  );
}

/** "Dec 14". */
function day(iso: string | null): string {
  if (!iso) return "the end of the month";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const REFUSED: Record<string, string> = {
  already_pro: "You're already on Pro.",
  not_subscribed: "You're not paying for Pro.",
  stripe_unavailable: "Payments are not available right now.",
};

function refusal(err: unknown, fallback: string): string {
  if (err instanceof EFError && err.code && REFUSED[err.code])
    return REFUSED[err.code];
  return fallback;
}

/** Checkout's return id (`?plan=cs_…`), read once and stripped from the
 *  address so a reload does not confirm twice. */
function takeSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  const id = url.searchParams.get("plan");
  if (!id) return undefined;
  url.searchParams.delete("plan");
  window.history.replaceState(window.history.state, "", url.toString());
  return id;
}

export function PlanModal({ fallback = false }: { fallback?: boolean }) {
  const getSupabase = useLazyBrowserSupabase();
  const [view, setView] = useState<GuestPlanView | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (fallback) return;
    let live = true;
    const sessionId = reload === 0 ? takeSessionId() : undefined;
    apiGetPlan(getSupabase(), sessionId).then(
      (v) => {
        if (!live) return;
        setView(v);
        setFailed(false);
        if (v.confirmed === "paid") setNotice("You're on Pro.");
        else if (v.confirmed === "pending")
          setNotice(
            "Your payment is still processing. Check back in a minute.",
          );
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [fallback, getSupabase, reload]);

  async function upgrade() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiStartPlan(
        getSupabase(),
        `${window.location.origin}${window.location.pathname}`,
      );
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      setNotice("Pro will renew.");
      setReload((n) => n + 1);
    } catch (err) {
      setError(refusal(err, "Couldn't open checkout. Try again."));
    }
    setBusy(false);
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiCancelPlan(getSupabase());
      setNotice(`Pro won't renew. It stays on until ${day(res.paid_until)}.`);
      setReload((n) => n + 1);
    } catch (err) {
      setError(refusal(err, "Couldn't cancel. Try again."));
    }
    setBusy(false);
  }

  const plan = view?.plan ?? null;
  const paidPro = plan === "premium" && !view?.granted;

  // PRO'S ACTION LIVES IN ITS CARD (MESITA-3899). An operator's grant
  // (granted) has none: nothing to buy, nothing to cancel.
  const proAction =
    plan === "free" ? (
      <Button
        size="lg"
        className={cn(ME_BUTTON_CLASS, "w-full")}
        onClick={upgrade}
        disabled={busy}
        data-plan-upgrade=""
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Upgrade to Pro
      </Button>
    ) : paidPro && view && !view.cancel_at_period_end ? (
      <p className="text-muted-foreground type-label">
        Renews {day(view.paid_until)} ·{" "}
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="text-foreground font-semibold underline"
          data-plan-cancel=""
        >
          Cancel Pro
        </button>
      </p>
    ) : paidPro && view?.cancel_at_period_end ? (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground type-label">
          Ends {day(view.paid_until)}, then you&apos;re on Free.
        </p>
        <Button
          size="lg"
          className={cn(ME_BUTTON_CLASS, "w-full")}
          onClick={upgrade}
          disabled={busy}
          data-plan-keep=""
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Keep Pro
        </Button>
      </div>
    ) : null;

  return (
    <MeScreen title="Plan">
      <div className="flex flex-col gap-3">
        <UsageCard view={view} />
        <PlanCard words={PLAN_ROWS.free} current={plan === "free"} />
        <PlanCard
          words={PLAN_ROWS.premium}
          current={plan === "premium"}
          featured
        >
          {proAction}
        </PlanCard>
      </div>

      <div className="mt-4 flex flex-col gap-3" aria-live="polite">
        {failed && (
          <div className={cn(ERROR_BOX_CLASS, "text-sm")} role="alert">
            Couldn&apos;t load your plan.{" "}
            <button
              type="button"
              onClick={() => setReload((n) => n + 1)}
              className="font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}
        {error && <p className={cn(ERROR_BOX_CLASS, "text-sm")}>{error}</p>}
        {notice && (
          <p className={cn(INFO_BOX_CLASS, "text-foreground text-sm")}>
            {notice}
          </p>
        )}
      </div>
    </MeScreen>
  );
}
