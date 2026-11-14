"use client";

// Me › Plan (/me/plan). SOLD AGAIN (Pato, 2026-11-14, MESITA-3870: "Add the
// Plan again. 2 Reservations per month is Free. 10 Reservations per month if
// Pro. thats it. and make it 2 dollar per month. Easy peasy."):
//
// Then $1 and "Max" (MESITA-3881, Pato: "charge 1 dollars, not 2 dollars"):
//
//   This month: 1 of 2 reservations
//   ┌ Free   Current            Free ┐
//   │ Max 2 reservations a month     │
//   ├ Pro                $1 a month ┤
//   │ Max 10 reservations a month    │
//   └────────────────────────────────┘
//   [ Upgrade to Pro · $1 a month ]     Free
//   Pro renews Dec 14 · Cancel Pro      paid Pro
//   Pro ends Dec 14 · [ Keep Pro ]      cancelled Pro
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
import { CreditCard, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  PLAN_ROWS,
  PRO_PRICE_LINE,
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
import {
  CurrentPill,
  IconChip,
  ME_BUTTON_CLASS,
  MeLead,
  RowDivider,
  SettingsGroup,
} from "./settings-rows";

function PlanRow({
  words,
  icon,
  current,
}: {
  words: PlanRowWords;
  icon: React.ReactNode;
  current: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" data-plan-row={words.title}>
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">
            {words.title}
            {current && <CurrentPill data-plan-current="" />}
          </span>
          <span className="text-muted-foreground type-label shrink-0">
            {words.price}
          </span>
        </span>
        <span className="text-muted-foreground type-label block">
          {words.perk}
        </span>
      </div>
    </div>
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
  if (err instanceof EFError && err.code && REFUSED[err.code]) return REFUSED[err.code];
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
          setNotice("Your payment is still processing. Check back in a minute.");
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

  return (
    <MeScreen title="Plan">
      <MeLead>
        {view
          ? `This month: ${view.used} of ${view.cap} reservations.`
          : "Reservations a month, by plan."}
      </MeLead>
      <SettingsGroup>
        <PlanRow
          words={PLAN_ROWS.free}
          current={plan === "free"}
          icon={<CreditCard className="h-[18px] w-[18px]" />}
        />
        <RowDivider />
        <PlanRow
          words={PLAN_ROWS.premium}
          current={plan === "premium"}
          icon={<Sparkles className="h-[18px] w-[18px]" />}
        />
      </SettingsGroup>

      <div className="mt-5 flex flex-col gap-3" aria-live="polite">
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
          <p className={cn(INFO_BOX_CLASS, "text-foreground text-sm")}>{notice}</p>
        )}

        {plan === "free" && (
          <Button
            size="lg"
            className={cn(ME_BUTTON_CLASS, "w-full")}
            onClick={upgrade}
            disabled={busy}
            data-plan-upgrade=""
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Upgrade to Pro · {PRO_PRICE_LINE}
          </Button>
        )}

        {paidPro && view && !view.cancel_at_period_end && (
          <p className="text-muted-foreground type-label text-center">
            Pro renews {day(view.paid_until)}.{" "}
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
        )}

        {paidPro && view?.cancel_at_period_end && (
          <>
            <p className="text-muted-foreground type-label text-center">
              Pro ends {day(view.paid_until)}, then you&apos;re on Free.
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
          </>
        )}
      </div>
    </MeScreen>
  );
}
