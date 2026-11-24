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
//   │ ✓ Max 3 reservation tickets a month │
//   └────────────────────────────────┘
//   ┏ Pro            $1 USD a month ┓   2px ink border
//   ┃ ✓ Max 10 reservation tickets a month ┃
//   ┃ ✓ MCP for ChatGPT or Claude Soon┃
//   ┃ [ Upgrade to Pro ]              ┃  Free guests
//   ┃ Renews Dec 14 · Cancel Pro      ┃  paid Pro
//   ┃ Ends Dec 14 · [ Keep Pro ]      ┃  cancelled Pro
//   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
//
// IN BOXES SINCE MESITA-4052 (Pato 2026-11-15: "put sections into boxes …
// the button module or section must also have a hr line dividing stuff from
// white land"; decision 1D): the guest's CURRENT plan is the first box, with
// its Current pill and this month's usage inside it; the other plan is the
// box under it. Upgrade to Pro and Keep Pro sit in MeScreen's footer band
// under a hairline; Renews · Cancel Pro stays in Pro's box. Before the read
// both plans sit in one box, under the usage box, nothing marked.
//
// LIMIT FIRST, ONE PLANS CARD SINCE MESITA-4359 (/plan-design-review "Better
// design for the plan", Pato 2026-11-18, eleven picks): the "This month" box
// first ("Limit reached · 8 of 3 used", and a Free guest at or over the cap
// reads "Pro gives you 2 more now"), then one "Plans" box: Free, then Pro,
// always in that order, Current on the guest's row. Free's price is "$0";
// Pro's is the name's size. Under Upgrade: "Billed monthly in USD · Cancel
// anytime". The loaded page and the loading frame are one shape; the "Your
// plan" / "Other plan" boxes above are gone.
//
// PLANS AS PRODUCTS SINCE MESITA-4385 (Pato 2026-11-18 on the page above:
// "omg. this looks like shit … add boxes and shit. add colors. must look
// like fucking products"; mock B "Pro hero"): the usage card, then Mesita
// Pro as a card with a brand-pink band (name, "$1" large, "USD a month"),
// two pink stat tiles (10 tickets a month, +7 more than Free), the Soon
// perk, and its action inside the card (Upgrade with the terms, Renews ·
// Cancel Pro, or Keep Pro); then Free as one grey line with a ticket mark
// and "$0". No footer band and no Plans/Your plan boxes. Pro is the one
// coloured product on Me; the rest of the app stays achromatic.
//
// CLEANER SINCE MESITA-4388 (Pato: "free on top of pro. and chill out with
// your fucking shadows and ilumaination..its just a fucking subscription"):
// Free sits above Pro, white; Pro has a hairline border and no shadow or
// glow, a slimmer band with "$1 USD a month", two grey boxes (Pro's
// reservations per month", "MCP connector · Soon"; no "+7 more than Free"),
// and the app's ink Upgrade button.
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
import { Loader2, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PLAN_ROWS } from "@/components/consumer/me/plan-words";
import {
  apiCancelPlan,
  apiGetPlan,
  type GuestPlanView,
} from "@/lib/api/plan";
import { PRO_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";
import { resetDay } from "@/lib/reset-day";
import { refusal, startUpgrade } from "@/lib/start-upgrade";
import { PRO_INK, ProOffer, UpgradeAction } from "./ProOffer";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  CurrentPill,
  ME_BUTTON_CLASS,
} from "./settings-rows";

/** Free as one line above Pro (MESITA-4385; above and white since
 *  MESITA-4388): a ticket mark, the name with its Current pill, its monthly
 *  tickets and "$0". */
function FreeLine({ current }: { current: boolean }) {
  const words = PLAN_ROWS.free;
  return (
    <section
      aria-label={words.title}
      data-plan-row={words.title}
      className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5"
    >
      <span className="bg-muted grid h-10 w-10 shrink-0 place-items-center rounded-xl">
        <Ticket className="text-muted-foreground h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-tight font-bold">
          {words.title}
          {current && <CurrentPill data-plan-current="" />}
        </h3>
        <p className="text-muted-foreground text-sm">{words.perk}</p>
      </div>
      <span className="shrink-0 text-lg font-bold tabular-nums">
        {words.price}
      </span>
    </section>
  );
}

/** This month's usage (MESITA-3899), the reason to upgrade, as its own card
 *  (MESITA-4385): "{used} of {cap} tickets used" with a red "Limit reached"
 *  pill at or over the cap, the bar (ink, red when full), then the reset
 *  day and, for a Free guest at or over the cap, how many more Pro gives
 *  this month in pink. A guest can be over the cap (tickets booked before it
 *  fell to 3), so the bar's value is clamped and the spoken text carries the
 *  true count (MESITA-4359, 9A). */
function UsageCard({ view }: { view: GuestPlanView | null }) {
  const used = view?.used ?? 0;
  const cap = view?.cap ?? 0;
  const full = !!view && used >= cap;
  const ratio = view && cap > 0 ? Math.min(used / cap, 1) : full ? 1 : 0;
  const proMore =
    view?.plan === "free" && full ? PRO_RESERVATIONS_PER_MONTH - used : 0;
  return (
    <section
      className="border-border bg-card rounded-2xl border p-4"
      aria-label="This month"
      data-plan-usage
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {view ? `${used} of ${cap} reservations used` : "Reservations this month"}
        </p>
        {full && (
          <span className="bg-destructive/10 text-destructive type-meta shrink-0 rounded-full px-2 py-0.5 font-semibold">
            Limit reached
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Reservations used this month"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={view ? Math.min(used, cap) : undefined}
        aria-valuetext={
          view
            ? `${used} of ${cap} reservations used${full ? ", limit reached" : ""}`
            : undefined
        }
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
        {proMore > 0 && (
          <>
            {" · "}
            <span className="font-semibold" style={PRO_INK}>
              Pro gives you {proMore} more now
            </span>
          </>
        )}
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

/** Checkout's return id (`?plan=cs_…`). It stays in the address until a read
 *  says paid or failed: nothing else ties the payment to the guest (no webhook). */
function sessionIdInUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URL(window.location.href).searchParams.get("plan") ?? undefined;
}

function clearSessionId() {
  const url = new URL(window.location.href);
  url.searchParams.delete("plan");
  window.history.replaceState(window.history.state, "", url.toString());
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
    const sessionId = sessionIdInUrl();
    apiGetPlan(getSupabase(), sessionId).then(
      (v) => {
        if (!live) return;
        setView(v);
        setFailed(false);
        if (v.confirmed === "paid") {
          clearSessionId();
          setNotice("You're on Pro.");
        } else if (v.confirmed === "pending")
          setNotice(
            "Your payment is still processing. Check back in a minute.",
          );
        else if (v.confirmed === "failed") {
          clearSessionId();
          setNotice(null);
          // An old return link on a guest who pays for Pro says nothing.
          if (v.plan === "free") setError("Your payment didn't go through. Try again.");
        } else if (sessionId && v.plan === "free") {
          setError("Couldn't check your payment. Reload to try again.");
        }
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
    // One money path with the reserve flow (lib/start-upgrade.ts); Me ›
    // Plan's return URL stays /me/plan.
    const res = await startUpgrade(
      getSupabase(),
      `${window.location.origin}${window.location.pathname}`,
    );
    if (res.kind === "redirect") {
      window.location.assign(res.url);
      return;
    }
    if (res.kind === "resumed") {
      setNotice("Pro will renew.");
      setReload((n) => n + 1);
    } else if (res.kind === "already_pro") {
      setError("You're already on Pro.");
      setReload((n) => n + 1);
    } else {
      setError(res.message);
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

  /** Pro's button, the app's ink button, inside Pro's card (MESITA-4385: no
   *  footer band, so no white gap between the product and its action). */
  const proButton = (label: string, data: Record<string, string>) => (
    <Button
      size="lg"
      className={cn(ME_BUTTON_CLASS, "w-full")}
      onClick={upgrade}
      disabled={busy}
      {...data}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );

  // What Pro's card ends with, by the guest's plan. An operator's grant
  // (granted) has nothing to buy and nothing to cancel.
  const proAction =
    // A payment still processing is never bought twice.
    plan === "free" && view?.confirmed === "pending" ? null : plan === "free" ? (
      <UpgradeAction onUpgrade={upgrade} busy={busy} />
    ) : paidPro && view && !view.cancel_at_period_end ? (
      <p className="text-muted-foreground type-label">
        Renews {day(view.paid_until)} ·{" "}
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          // A 44px tap target that keeps the line's height (MESITA-4359, 10A).
          className="text-foreground -my-3 inline-flex min-h-11 items-center font-semibold underline"
          data-plan-cancel=""
        >
          Cancel Pro
        </button>
      </p>
    ) : paidPro && view?.cancel_at_period_end ? (
      <div className="mt-1 flex flex-col gap-2">
        {proButton("Keep Pro", { "data-plan-keep": "" })}
        <p className="text-muted-foreground type-label text-center">
          Ends {day(view.paid_until)}, then you&apos;re on Free.
        </p>
      </div>
    ) : null;

  // The month, then Free, then Mesita Pro (MESITA-4388, Pato: "free on top
  // of pro"). Before the read the same shape draws with no pill and
  // no button.
  return (
    <MeScreen title="Plan">
      <div className="flex flex-col gap-4">
        <UsageCard view={view} />
        <FreeLine current={plan === "free"} />
        <ProOffer current={plan === "premium"}>{proAction}</ProOffer>
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
