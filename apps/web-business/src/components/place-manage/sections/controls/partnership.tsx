"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { STRATEGY_BY_ID, type StrategyId } from "@/lib/business/strategies";
import { type AdminPlace } from "../../actions";
import {
  describeMembershipState,
  lifecycleView,
  type LifecycleStepState,
  type MembershipPillState,
} from "../promo-state";
import { cx, ZERO_STRATEGY_ID } from "./shared";

// Partnership box + its lifecycle rail + the status pill. Moved verbatim out
// of PromosSection.tsx on 2026-09-02 (file split, no behaviour change).
//
// ── TWO TIERS (MESITA-1867, Pato 2026-09-15) ──────────────────────────────
//
// The partnership used to be one free switch on the organization's page,
// locked until its Stripe account was Ready — so this body said "Partner is
// free" and step 1 said "Turn on Partner on Organization — it's free." Both
// were true and both are gone: Stripe Connect onboarding was the price of
// admission to REWARDS, which never needed a charge path, and that friction
// shrank the market. Now, and since MESITA-1892 both of them are the PLACE's
// own, in its Products catalogue:
//
//   Mesita Partner   this place's YEARLY subscription (`places.partnered`).
//                    It is what unlocks Conservative and Aggressive here (and
//                    Accept Prepays on the Credits view).
//   Mesita Pay       an optional add-on — the Stripe account and card
//                    payments, at `products/pay`. Not this box's concern: a
//                    reward is what a guest EARNS, and no reward needs a
//                    charge path.
//
// Zero stays free — it is the absence of the product, not its bottom rung.
//
// The body renders for EVERY pill state now, not only for members. A
// forfeited place reads plan=free (the strike patch drops the plan), so a
// member-gated body could never show the forfeited copy or its door; and a
// place that was never in needs the pitch more than a member does.
//
// A NON-MEMBER GETS THE PITCH ALONE. The first cut of MESITA-1867 rendered
// the lifecycle banner for every state, so a place that had not subscribed
// read the same door three times in eight lines: the page's top line ("Become
// a Mesita Partner in Products —", linked), the banner's step 1 ("Subscribe —
// yearly…"), then this paragraph. The top line is the door; the banner is for
// a place that is in
// (or was), where the three steps mean something; the pitch is what a
// non-member needs.
//
// ── THE RE-JOIN BUTTON (MESITA-1891) ─────────────────────────────────────
//
// Forfeit drops this place to plan=free and stamps `plan_forfeited_at`, while
// the Membership it bought is untouched — so the way back is a re-join, never
// "turn the subscription off and on". The same door serves a DROPPED place —
// out of the partnership while the Membership is live — which reads plan=free
// without a forfeit stamp.
//
// THE DOOR WAS GUARDED FIRST AND WIRED SECOND, on purpose. MESITA-1889 made
// the one join door (`setPlacePlan` → `business-web-set-partnership
// {action:"join"}`) refuse unless the holder was `partnered` AND the caller
// owned it; MESITA-1892 removed the holder, so it asks the PLACE those same
// two questions (409 `place_not_partnered`, then 403). Only then could a
// button exist without handing an editor a free plan=pro under a paid tier.
// Until this issue the honest state was one line saying when it landed; a
// DISABLED primary button was never an option, because a knob that pretends
// is what the house law (SoonStrip.tsx) forbids.
//
// THIS COMPONENT STAYS HOOK-FREE. `onRejoin` and `rejoinPending` come from
// `PromosSection`, which already holds this place's row, its role and the
// router — and which is where the `router.refresh()` after a successful join
// has to happen, because the Partner chip is computed on the SERVER and
// nothing in `place-manage/actions.ts` revalidates. Keeping the write out of
// here also keeps this box renderable by `renderToStaticMarkup`, which is the
// only way its six pill states are tested at all.
//
// WHOSE ACTION IT IS: the owner's, because the Membership it re-enters is the
// owner's. Everyone else keeps the sentence.

// ─── Lifecycle banner — this place's progress on the three Tutorial steps ─
//
// A plain list of the three steps + ONE detail line for the step you're on.
// Pato, 2026-09-08: "remove this shit, just easy list of capabilities" — the
// numbered circles and connecting rail this used to draw were ornament this
// console's own rule says to skip ("calm and high-density — don't ornament
// them"); a done step gets a check, everything else a dot, done. Every rail
// state has exactly one current-or-blocked step, so one detail line still
// says the same thing the old wall-of-three-descriptions did. Live on a paid
// strategy collapses to a slim strip (the teaching job is done; strikes keep
// it honest). Non-interactive on purpose: the actionable controls stay in
// the Partnership box and strategy cards. decision: the banner does NOT
// repeat the partnership status pill — the Membership box header keeps the
// only pill in the viewport.

const STEP_TITLES = {
  join: "Become a Mesita Partner",
  strategy: "Pick a strategy",
  honor: "Honor guest checks",
} as const;

function LifecycleBanner({
  place,
  pillState,
  storedStrategy,
  member,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  storedStrategy: StrategyId | null;
  member: boolean;
}) {
  const view = lifecycleView(place, storedStrategy);
  const strategy =
    member && storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;

  if (view.kind === "strip") {
    const warn = view.tone === "warn";
    return (
      <section className="border-border/60 rounded-xl border px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 type-body">
          <span
            aria-hidden
            className={cx(
              "h-2 w-2 shrink-0 self-center rounded-full",
              warn ? "bg-destructive" : "bg-foreground",
            )}
          />
          <span className="font-display font-semibold tracking-tight">
            Partner live
          </span>
          <span className={warn ? "text-destructive" : "text-muted-foreground"}>
            {warn
              ? `${view.strikes} active strike${view.strikes === 1 ? "" : "s"} of 3 — the third forfeits the partnership.`
              : "All three steps done — joined, strategy set, checks honored."}
          </span>
        </p>
      </section>
    );
  }

  const forfeited = pillState === "forfeited";

  // Helper copy per step, keyed off the derived state + pill. Only the active
  // step's line renders. Step 1 is never the active step here: `join` is
  // "current" only for a non-member, and a non-member gets the pitch alone
  // (PartnershipBody) — so this line is the done/upcoming reading, and the
  // "Subscribe" instruction it used to carry lives on the page's top line,
  // once.
  const joinDetail = "Yearly — switch strategies anytime.";
  const strategyDetail =
    view.strategy === "done" && strategy
      ? `${strategy.emoji} ${strategy.name} — switch anytime.`
      : view.strategy === "current"
        ? storedStrategy === ZERO_STRATEGY_ID
          ? "Zero pauses discounts — pick a paid strategy to reopen the lane."
          : "Custom rates — pick a strategy to standardize."
          : "Conservative or Aggressive — switch anytime.";
  // Forfeited: the page's top line already names the three strikes and says
  // when re-join lands, so this step's line says what the third strike did to
  // the steps — honoring is blocked, and the strategy is picked again on the
  // way back (lifecycleView resets it). It used to say "re-join this place
  // below", which pointed at a button that no longer renders.
  const honorDetail =
    view.honor === "blocked"
      ? forfeited
        ? "Forfeited on the third strike — the strategy is picked again after re-joining."
        : `Discounts paused until ${String(place.promo_paused_until ?? "").slice(0, 10)} (strike 2 of 3).`
      : view.honor === "current"
        ? "Staff scan the guest's QR on Mesita Validate — honor the first check at the bill to go live."
        : view.honor === "done"
          ? "Activated — the first guest check was honored."
          : "The first honored check makes you live — turning a guest away is a strike.";

  const steps: {
    key: keyof typeof STEP_TITLES;
    state: LifecycleStepState;
    detail: string;
  }[] = [
    { key: "join", state: view.join, detail: joinDetail },
    { key: "strategy", state: view.strategy, detail: strategyDetail },
    { key: "honor", state: view.honor, detail: honorDetail },
  ];

  // Exactly one step is blocked-or-current in every rail state (see
  // lifecycleView) — that one carries the line.
  const active =
    steps.find((s) => s.state === "blocked") ??
    steps.find((s) => s.state === "current");

  return (
    <section className="border-border/60 rounded-xl border px-4 py-3">
      {/* The list replaced a visible "How promos go live" heading — the steps
          say it. Keep the label for screen readers. */}
      <h2 className="sr-only">How promos go live</h2>
      <ul className="flex flex-col gap-1.5">
        {steps.map((s) => (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {s.state === "done" ? (
              <Check
                className="text-foreground h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
            ) : (
              <span
                aria-hidden
                className={cx(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  s.state === "upcoming" ? "bg-border" : "bg-foreground",
                )}
              />
            )}
            <span
              className={cx(
                "type-body leading-none",
                s.state === "current" || s.state === "blocked"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground font-medium",
              )}
            >
              {STEP_TITLES[s.key]}
            </span>
          </li>
        ))}
      </ul>
      {active && (
        <p
          className={cx(
            "mt-2.5 text-xs leading-snug",
            // `active` is blocked-or-current by construction; only forfeiture
            // earns destructive red.
            active.state === "blocked" && forfeited
              ? "text-destructive"
              : "text-foreground",
          )}
        >
          {active.detail}
        </p>
      )}
    </section>
  );
}

// ─── Box 2 · Partnership ───────────────────────────────────────────────────

export function PartnershipBody({
  place,
  pillState,
  storedStrategy,
  member,
  setupHref,
  isOwner,
  onRejoin,
  rejoinPending = false,
  rejoinError = null,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  storedStrategy: StrategyId | null;
  member: boolean;
  /** The place's own Mesita Pay page, where the subscription's banner is one
   *  click up and the account it gates is on the page itself. */
  setupHref: string;
  /** Owner of this place. Re-join is owner-only because the subscription it
   *  re-enters is the owner's; everyone else reads. */
  isOwner: boolean;
  /** PRESENT ⇒ this caller may re-join: an owner, of a place whose Membership
   *  the console has actually READ as live. Absent is not "no" — it is also
   *  "the rail has not answered yet", which is why the button is gated on the
   *  handler rather than on `isOwner` alone. */
  onRejoin?: () => void;
  rejoinPending?: boolean;
  /** This place's failed join, in operator words. Never a raw EF string. */
  rejoinError?: string | null;
}) {
  const notMember = pillState === "not_member";
  const forfeited = pillState === "forfeited";
  const underReview = pillState === "review";
  const canDrop = member && !forfeited;
  // Pending has no note (the banner's step 3 line says it). A non-member
  // has none (the pitch alone). Forfeited keeps its red note — it is the
  // ONE forfeited sentence on this box, because the banner does not render
  // for a place that is out (plan=free), and the page's top line says when
  // re-join lands, not what happened.
  const stateNote =
    pillState === "pending" || notMember
      ? null
      : describeMembershipState(place, pillState);

  // No line for a non-member (the page's top line is the door), for review
  // (its own paragraph below), or for forfeited (its own line below).
  const nextLine = notMember || underReview || forfeited
    ? null
    : "Switching to Zero pauses discounts without ending the partnership. The partnership is managed in Products.";

  return (
    <div className="flex flex-col gap-3 pb-3">
        {/* The three steps mean something only for a place that is IN.
            A non-member gets the pitch alone (the top line is its door); a
            forfeited place reads plan=free and gets its note and its line —
            a banner whose step 1 says "Yearly — every place is in" over a
            red "forfeited" note would be the contradiction the review
            caught. */}
        {member && (
          <LifecycleBanner
            place={place}
            pillState={pillState}
            storedStrategy={storedStrategy}
            member={member}
          />
        )}
        {stateNote && (
          <p
            className={cx(
              "rounded-xl px-3 py-2 text-xs leading-snug",
              stateNote.tone === "live" &&
                "bg-muted text-foreground",
              stateNote.tone === "warn" && "bg-muted text-foreground",
              stateNote.tone === "blocked" &&
                "bg-destructive/10 text-destructive",
            )}
          >
            {stateNote.label}
          </p>
        )}

        <p className="text-muted-foreground type-body leading-snug">
          <span className="text-foreground font-semibold">Mesita Partner</span>{" "}
          is this place&apos;s yearly partnership. It unlocks{" "}
          <span className="text-foreground font-semibold">Conservative</span>{" "}
          and <span className="text-foreground font-semibold">Aggressive</span>{" "}
          here. Zero stays free.
        </p>

        {nextLine && (
          <p className="text-muted-foreground text-xs leading-snug">
            {nextLine}
          </p>
        )}

        {underReview && (
          <p className="text-muted-foreground type-meta leading-snug">
            Mesita is reviewing this place. Visit Rewards stay on hold
            until that review ends — an operator cannot lift their own hold.
          </p>
        )}

        {/* THE DOOR. One sentence saying what re-joining does, then either the
            button or who may press it — never both, and never a disabled one.
            A caller with no handler and no rank reads the sentence alone: the
            page's top line is their door. */}
        {(forfeited || onRejoin != null) && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs leading-snug">
              {forfeited
                ? "Re-joining clears the strikes and the forfeit; the yearly subscription is untouched."
                : "Re-joining puts this place back in the partnership; the yearly subscription is untouched."}
            </p>
            {onRejoin ? (
              <button
                type="button"
                onClick={onRejoin}
                disabled={rejoinPending}
                className={cx(
                  CTA_BUTTON_CLASS,
                  "self-start",
                  rejoinPending && "cursor-default opacity-60",
                )}
              >
                {rejoinPending ? "Re-joining…" : "Re-join this place"}
              </button>
            ) : !isOwner ? (
              <p className="text-muted-foreground text-xs leading-snug">
                An owner re-joins this place.
              </p>
            ) : null}
            {/* Always mounted: a live region that appears with its message
                does not announce. */}
            <div aria-live="polite">
              {rejoinError && <ErrorNote message={rejoinError} />}
            </div>
          </div>
        )}

        {canDrop && (
          <Link
            href={setupHref}
            className="text-muted-foreground hover:text-foreground self-start text-xs font-semibold underline underline-offset-4 transition"
          >
            Manage the partnership in Products
          </Link>
        )}
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

export function MembershipStatePill({ state }: { state: MembershipPillState }) {
  const labels: Record<MembershipPillState, string> = {
    not_member: "Not a partner",
    pending: "Partner — pending",
    live: "Partner — live",
    paused: "Paused",
    forfeited: "Forfeited",
    review: "Under review",
  };
  const liveish = state === "live" || state === "pending";
  const amber = state === "paused" || state === "review";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 type-meta font-bold tracking-wide uppercase",
        state === "forfeited" && "bg-destructive/10 text-destructive",
        amber && "bg-muted text-foreground dark:bg-muted dark:text-muted-foreground",
        liveish && "bg-muted text-foreground dark:text-muted-foreground",
        state === "not_member" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          state === "forfeited" && "bg-destructive",
          amber && "bg-foreground",
          liveish && "bg-foreground",
          state === "not_member" && "bg-muted-foreground/50",
        )}
      />
      {labels[state]}
    </span>
  );
}

