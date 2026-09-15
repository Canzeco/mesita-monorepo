"use client";

import Link from "next/link";
import { Check } from "lucide-react";
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
// The partnership used to be one free switch on Organization, locked until
// the org's Stripe account was Ready — so this body said "Partner is free"
// and step 1 said "Turn on Partner on Organization — it's free." Both were
// true and both are gone: Stripe Connect onboarding was the price of
// admission to REWARDS, which never needed a charge path, and that friction
// shrank the market. Now:
//
//   Mesita Partner   the organization's YEARLY subscription; every place it
//                    holds is in. It is what unlocks Conservative and
//                    Aggressive here (and Accept Prepays on Capabilities).
//   Mesita Pay       an optional add-on on Organization — the Stripe account
//                    and card payments. Not this page's concern: Rewards is
//                    what a guest EARNS, and no reward needs a charge path.
//
// Zero stays free — it is the absence of the product, not its bottom rung.
//
// The body renders for EVERY pill state now, not only for members. A
// forfeited place reads plan=free (the strike patch drops the plan), so a
// member-gated body could never show the forfeited copy or its door; and a
// place that was never in needs the pitch more than a member does.
//
// A NON-MEMBER GETS THE PITCH ALONE. The first cut of MESITA-1867 rendered
// the lifecycle banner for every state, so a place whose organization had
// not subscribed read the same door three times in eight lines: the page's
// top line ("Become a Mesita Partner on Organization —", linked), the
// banner's step 1 ("Subscribe on Organization — yearly…"), then this
// paragraph. The top line is the door; the banner is for a place that is in
// (or was), where the three steps mean something; the pitch is what a
// non-member needs.
//
// ── WHY THERE IS NO RE-JOIN BUTTON YET ───────────────────────────────────
//
// Forfeit is PER PLACE (three strikes drop this place to plan=free and stamp
// plan_forfeited_at) while the subscription is PER ORGANIZATION — so the way
// back is a place action, "re-join this place", never "toggle the org". The
// door is now guarded but still unwired: MESITA-1889 made the one join door
// (`setPlacePlan` → `business-web-set-partnership {action:"join"}`) refuse
// unless the holder organization is `partnered` AND the caller owns it (409
// `org_not_partnered`), so it can no longer let an editor put any place on
// plan=pro for nothing under a paid tier. Only the button is left, and it
// belongs to MESITA-1891. The plan had it render disabled meanwhile — but a
// disabled primary button is a knob that pretends, the exact thing the
// house law (SoonStrip.tsx) forbids and the reason the Partner modal on
// Organization has no Continue button. So the door's honest state is one
// line: the page's top line says when re-join lands, and this box says what
// re-joining will do and whose action it is (the owner's — the subscription
// it re-enters is the owner's). PR 2 adds the button when it does something.
// The same door serves a DROPPED place — not in the partnership while its
// organization is — which reads plan=free without a forfeit stamp.

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
              warn ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
          <span className="font-display font-semibold tracking-tight">
            Partner live
          </span>
          <span className={warn ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}>
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
  // "Subscribe on Organization" instruction it used to carry lives on the
  // page's top line, once.
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
                className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <span
                aria-hidden
                className={cx(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  s.state === "upcoming" ? "bg-border" : "bg-amber-500",
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
              : "text-amber-800",
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
  orgHref,
  isOwner,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  storedStrategy: StrategyId | null;
  member: boolean;
  orgHref: string;
  /** Owner of the holder organization. Re-join is owner-only because the
   *  subscription it re-enters is the owner's; everyone else reads. */
  isOwner: boolean;
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
    : "Switching to Zero pauses discounts without ending the partnership. The partnership is managed on Organization.";

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
                "bg-emerald-500/10 text-emerald-800",
              stateNote.tone === "warn" && "bg-amber-500/10 text-amber-900",
              stateNote.tone === "blocked" &&
                "bg-destructive/10 text-destructive",
            )}
          >
            {stateNote.label}
          </p>
        )}

        <p className="text-muted-foreground type-body leading-snug">
          <span className="text-foreground font-semibold">Mesita Partner</span>{" "}
          is the organization&apos;s yearly partnership. It unlocks{" "}
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

        {/* NO BUTTON — see the docblock. The door's honest state is one
            line: what re-joining will do, whose action it is, and when it
            lands. */}
        {forfeited && (
          <p className="text-muted-foreground text-xs leading-snug">
            {isOwner
              ? "Re-join lands with the next release — it clears the strikes and the forfeit for this place; the organization's partnership is untouched."
              : "An owner re-joins this place when re-join lands with the next release; the organization's partnership is untouched."}
          </p>
        )}

        {canDrop && (
          <Link
            href={orgHref}
            className="text-muted-foreground hover:text-foreground self-start text-xs font-semibold underline underline-offset-4 transition"
          >
            Manage the partnership on Organization
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
        amber && "bg-amber-500/12 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
        liveish && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        state === "not_member" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          state === "forfeited" && "bg-destructive",
          amber && "bg-amber-500",
          liveish && "bg-emerald-500",
          state === "not_member" && "bg-muted-foreground/50",
        )}
      />
      {labels[state]}
    </span>
  );
}

