"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import {
  STRATEGY_BY_ID,
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { useRailScopeContext } from "@/components/console/RailScopeContext";
import { findPlace } from "@/lib/active-place";
import { SHELL_ROUTES, placePayHref } from "@/lib/console-routes";
import {
  getPlacePaymentAccount,
  setPlacePlan,
  setPlaceRails,
  setPlaceStrategy,
  type AdminPlace,
  type PlaceRails,
} from "../actions";
import { OrdersCard } from "./OrdersCard";
import { ReservationsCard } from "./ReservationsCard";
import { VisitsCard } from "./VisitsCard";
import { GroupLabel, SectionCard } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { usePlaceContext } from "../PlaceContext";
import {
  isMemberPlan,
  membershipPillState,
  placeOperatorPromotingLevel,
  promoCardState,
} from "./promo-state";
import { PartnershipBody } from "./controls/partnership";
import { ProductModal, StrategyCard } from "./controls/strategy-cards";
import { LadderRow, NestedConfig } from "./controls/ladder-row";
import {
  connectStateFrom,
  controlWriteFailure,
  guestSummary,
  offeringRows,
  paintRows,
  railWriteFailure,
  rejoinFailure,
  rowsForZone,
  shouldRenderConfig,
  tierFlag,
  topPrerequisite,
  type ConnectState,
  type LadderRowKey,
  type LadderZone,
} from "./controls/offerings";
import { pickerStrategies, strategySwitchPatch, ZERO_STRATEGY_ID } from "./controls/shared";

// The place's ladder — rendered ONCE per zone, and a zone is a PRODUCT
// (MESITA-1841, re-cut by MESITA-1885).
//
// ONE ENGINE, SIX VIEWS (MESITA-1900). `zone` selects which rungs and which
// trailing blocks this renders: Rewards owns Visit Rewards, its strategy
// ladder and the Partnership body that prices them; Visits owns NO rung and
// keeps the internal "How this place is run" box; Orders owns pickup and
// delivery; Reservations, Payments and Credits own theirs. The rungs depend on
// one another (Partner unlocks Visit Rewards and Mesita Payments; Stripe
// unlocks the money rungs), so the COMPUTATION is never split — two copies of
// a dependency ladder is two copies that can disagree. `ZONE_ROWS` in
// controls/offerings.ts owns the mapping and a test proves it is total.
//
// THE TWO BLOCKS WENT TO DIFFERENT VIEWS, and that is the whole of what
// MESITA-1900 moved here. They rode Visits together from MESITA-1885, but they
// are about different subjects: the Partnership body prices Conservative and
// Aggressive (its own docblock calls it *"Rewards' own box"*), while "How this
// place is run" is how visits are run here. Each is now on the view it names.
//
// WHY FIVE AND NOT TWO. Pato put all eight products in the rail, and Orders,
// Reservations and Credits were three rows on the one Capabilities page —
// three rail rows, one address, all lighting together. Splitting the view is
// what lets a row name its room (MESITA-1833).
//
// MESITA-1739 first paint: summary of what guests can do, then the one
// prerequisite that unlocks the most rows, then the rows. The 0–7 meter
// left — ProfileCompleteness owns the meter where it belongs, and a
// coincidence with §11.2's seven capabilities is still a coincidence.
// Partnership is a PlaceHeading chip + one line; Partner and Stripe live on
// the place's own Products pages. Nested configs stay MOUNTED
// (shouldRenderConfig).
//
// TWO TIERS, BOTH THE PLACE'S (MESITA-1867, place-scoped MESITA-1892). Mesita
// Partner is the yearly subscription and the gate for Rewards; Mesita Pay is
// an optional add-on (the Stripe account and its switch) and the gate for the
// Pay rung. Both flags were the holding ORGANIZATION's and are `places.partnered`
// and `place_profiles.mesita_pay_enabled` now. The ladder still reads them off
// `RailScopeContext` — the shell already holds the viewer's places on every
// route, so this is zero extra reads — and `null` when this place is not in
// that list (a pool place, a page rendered without the shell), which the
// engine renders as Checking…, never off. The rungs still gate on the PLACE's
// own `member` (`plan ≠ free`); these two steer the top line and the Pay rung
// only (offerings.ts explains the precedence).
//
// THE PARTNERSHIP BODY RENDERS FOR EVERY PILL STATE on Visits. It used to be
// member-gated, and a forfeited place reads plan=free — so the forfeited
// copy and its Re-join door were dead on arrival. Non-members get it ABOVE
// the rows, as the pitch (the top line's Mesita Pay link is the one door);
// members keep it below, as before.

export function PromosSection({
  place,
  onSaved,
  zone,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
  /** Which half of the ladder this instance renders (MESITA-1841). */
  zone: LadderZone;
}) {
  const [v, setV] = useState(place);
  const { dirtyLabels } = usePlaceContext();
  // THE PREREQUISITE DOOR IS THIS PLACE'S OWN SETUP (MESITA-1892). It pointed
  // at the holding organization's page, where the Stripe Account box lived;
  // the account is `place_payment_accounts` now and its box is the place's
  // `products/pay` sub-step, so the door is one level in rather than one level
  // up. `place.id` is the page's own subject, so nothing has to be published
  // before the link resolves — which is what the root-resolver fallback used
  // to be for.
  const setupHref = place.id ? placePayHref(place.id) : SHELL_ROUTES.root;
  // The place's two tier flags, off the rail's own list (MESITA-1867). Null
  // when this place is not in the viewer's list — a pool place, a page
  // rendered without the shell — and null is "unknown", never "off".
  const railPlaces = useRailScopeContext()?.places ?? [];
  const railPlace = findPlace(railPlaces, place.id);
  // `?? null`, never `=== true`: both flags are OPTIONAL on the payload
  // ("UNDEFINED when the payload predates the EF — absent is not false",
  // lib/api/console.ts), and collapsing undefined to false would send a paying
  // place to subscribe again and lock its Pay rung "Off".
  const placePartnered = tierFlag(railPlace?.partnered);
  const placeMesitaPay = tierFlag(railPlace?.mesitaPayEnabled);
  // ONE ROLE READ, TWO VERDICTS. Re-join is owner-only (the subscription it
  // re-enters is the owner's) and so is the Mesita Pay rung
  // (`business-web-set-place-rails` takes `requireOwner` for that one key) —
  // but they want the unknown case answered differently, so both derive from
  // the same read rather than growing two.
  const myRole = railPlace?.myRole ?? null;
  // A button, so unknown means DON'T OFFER IT: nothing is lost by a missing
  // door, and a 403 after a press is worse.
  const isOwner = myRole === "owner";
  // A row's state, so unknown means DON'T CLAIM: `null` leaves the rung as it
  // was rather than telling an owner the switch is not theirs.
  const ownsPay = myRole === null ? null : myRole === "owner";

  const router = useRouter();
  const [switchPending, startSwitch] = useTransition();
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [railBusy, setRailBusy] = useState<keyof PlaceRails | null>(null);
  const [rowError, setRowError] = useState<
    { key: LadderRowKey; message: string } | null
  >(null);

  const [connect, setConnect] = useState<ConnectState>({ kind: "none" });
  const [connectLoading, setConnectLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void getPlacePaymentAccount(place.id, { refresh: true }).then((r) => {
      if (!alive) return;
      setConnectLoading(false);
      if (r.ok) setConnect(connectStateFrom(r.data.account, r.data.orphaned));
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const member = isMemberPlan(v.plan);
  const pillState = membershipPillState(v);
  const storedStrategy = strategyForPlace(v);
  const forfeited = pillState === "forfeited";
  const level = placeOperatorPromotingLevel(v);
  const rewardLaneHeld = Boolean(v.reward_lane_pending_review_at);

  const rails = {
    mesita_pay: v.mesita_pay_enabled === true,
    credits: v.credits_enabled === true,
    pickup: v.pickup_orders_enabled === true,
    delivery: v.delivery_orders_enabled === true,
    reservations:
      typeof v.reservations_enabled === "boolean" ? v.reservations_enabled : null,
  } satisfies Record<keyof PlaceRails, boolean> & { reservations: boolean | null };

  const ladderInput = {
    member,
    visitRewardsLevel: level,
    rails,
    connect,
    connectLoading,
    rewardLaneHeld,
    placePartnered,
    placeMesitaPay,
    isOwner: ownsPay,
    forfeited,
  };
  const rows = offeringRows(ladderInput);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  // THE ZONE'S ROWS, not the ladder's. `rows` stays whole — `topPrerequisite`
  // and the rail toggles below read the full ladder — and only what is PAINTED
  // narrows, so the summary line describes the view you are actually on.
  const zoneRows = rowsForZone(rows, zone);
  const painted = paintRows(zoneRows);
  // A ZONE WITH NO RUNGS DOES NOT GET THE LADDER'S SENTENCE (MESITA-1900).
  // `guestSummary` over an empty set answers "Right now, nothing is live for
  // guests." — which is false about a partner whose visit checkout works, and
  // exactly the class of lie MESITA-1882 and MESITA-1884 each paid for once.
  // Visits is that zone: it has no switch, no column and, since Rewards took
  // `visit_rewards` back, no row. So it states the container's own fact and
  // the ladder states the rest.
  const summary =
    zoneRows.length === 0
      ? "Guests can close their bill here. Visits is on for every Mesita Partner."
      : guestSummary(zoneRows);
  const prereq = topPrerequisite(ladderInput);

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };
  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
  };

  // RE-JOIN (MESITA-1891). The one join door, and the two facts that make it
  // pressable at all: the caller owns this place, and the console has READ
  // `places.partnered` as true. Both are re-checked server-side — the EF 409s
  // `place_not_partnered` and then 403s a non-owner — so this predicate is
  // what decides whether a button renders, never whether the write is allowed.
  const canRejoin = !member && placePartnered === true && isOwner;

  const commitRejoin = async () => {
    if (rejoinBusy) return;
    setRejoinBusy(true);
    setRejoinError(null);
    // NOT optimistic, unlike the rails: a join rewrites the plan, the strikes
    // and the forfeit stamp at once, so the only honest local state is the
    // row the EF hands back.
    const r = await setPlacePlan(place.id, "pro");
    setRejoinBusy(false);
    if (!r.ok) {
      console.error("[controls] setPlacePlan join failed:", r.error);
      setRejoinError(rejoinFailure(r.code ?? null));
      return;
    }
    applyPlace(r.data);
    // THE PARTNER CHIP IS SERVER-COMPUTED, and nothing in `../actions` calls
    // revalidatePath — so without this the rail, the products catalogue and
    // the place heading keep saying "not a partner" until the next navigation.
    router.refresh();
  };

  const commitSwitch = (target: StrategyId) => {
    setModalId(null);
    if (switchPending || !member || target === storedStrategy) return;
    const rates = strategySwitchPatch(target, v, storedStrategy);
    const prev = v;
    applyPlace({ ...v, ...rates });
    setSwitchError(null);
    startSwitch(async () => {
      const r = await setPlaceStrategy(prev.id, rates);
      if (!r.ok) {
        console.error("[controls] setPlaceStrategy failed:", r.error);
        revertPlace(prev);
        setSwitchError(controlWriteFailure("switch strategy"));
        return;
      }
      applyPlace(r.data);
    });
  };

  const RAIL_COLUMN = {
    mesita_pay: "mesita_pay_enabled",
    credits: "credits_enabled",
    pickup: "pickup_orders_enabled",
    delivery: "delivery_orders_enabled",
  } as const;

  const commitRail = async (
    key: keyof PlaceRails,
    rowKey: LadderRowKey,
    label: string,
    next: boolean,
  ) => {
    if (railBusy) return;
    const prev = v;
    const optimistic: AdminPlace = { ...v, [RAIL_COLUMN[key]]: next };
    applyPlace(optimistic);
    setRailBusy(key);
    setRowError(null);
    const r = await setPlaceRails(prev.id, { [key]: next });
    setRailBusy(null);
    if (!r.ok) {
      revertPlace(prev);
      console.error(`[controls] setPlaceRails ${key}=${next} failed:`, r.error);
      setRowError({ key: rowKey, message: railWriteFailure(label, next) });
      return;
    }
    applyPlace({
      ...optimistic,
      mesita_pay_enabled: r.data.mesita_pay,
      credits_enabled: r.data.credits,
      pickup_orders_enabled: r.data.pickup,
      delivery_orders_enabled: r.data.delivery,
    });
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;
  const errFor = (key: LadderRowKey) =>
    rowError?.key === key ? rowError.message : null;
  const railProps = (key: keyof PlaceRails, rowKey: LadderRowKey, label: string) => ({
    busy: railBusy === key,
    otherBusy: railBusy !== null && railBusy !== key,
    error: errFor(rowKey),
    onToggle: (next: boolean) => void commitRail(key, rowKey, label, next),
  });

  const fixFor = (key: LadderRowKey): ReactNode => {
    const d = byKey[key]?.disagreement;
    if (!d) return null;
    if (d.fix === "setup") {
      return (
        <Link
          href={setupHref}
          className="text-foreground font-semibold underline underline-offset-4"
        >
          {d.fixLabel}
        </Link>
      );
    }
    if (d.fix === "restore") {
      return (
        <span className="text-muted-foreground text-sm leading-snug">
          Mesita is reviewing this place
        </span>
      );
    }
    return null;
  };

  const rowNode = (key: LadderRowKey) => {
    switch (key) {
      case "partnership":
      case "stripe":
        return null;
      case "mesita_pay":
        return (
          <LadderRow
            key={key}
            row={byKey.mesita_pay}
            disagreementAction={fixFor("mesita_pay")}
            {...railProps("mesita_pay", "mesita_pay", "Mesita Payments")}
          />
        );
      case "visit_rewards":
        return (
          <LadderRow
            key={key}
            row={byKey.visit_rewards}
            disagreementAction={fixFor("visit_rewards")}
            error={switchError}
            control={
              switchPending ? (
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              ) : undefined
            }
          >
            <NestedConfig visible={member} label="Strategy">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pickerStrategies().map((s) => (
                  <StrategyCard
                    key={s.id}
                    strategy={s}
                    state={promoCardState({
                      member,
                      forfeited,
                      storedStrategy,
                      cardId: s.id,
                      paid: s.id !== ZERO_STRATEGY_ID,
                    })}
                    pending={switchPending && s.id === storedStrategy}
                    onOpen={() => setModalId(s.id)}
                  />
                ))}
              </div>
              {(storedStrategy === null || storedStrategy === "dominant") && member && (
                <p className="text-muted-foreground mt-2.5 type-label">
                  Current rates don&apos;t match a strategy — pick one to standardize.
                </p>
              )}
            </NestedConfig>
          </LadderRow>
        );
      case "accept_prepays":
        return (
          <LadderRow
            key={key}
            row={byKey.accept_prepays}
            disagreementAction={fixFor("accept_prepays")}
            {...railProps("credits", "accept_prepays", "Accept Prepays")}
          />
        );
      case "sell_prepays":
        return (
          <LadderRow
            key={key}
            row={byKey.sell_prepays}
            disagreementAction={fixFor("sell_prepays")}
          />
        );
      case "pickup":
        return (
          <LadderRow
            key={key}
            row={byKey.pickup}
            disagreementAction={fixFor("pickup")}
            {...railProps("pickup", "pickup", "Pickup Orders")}
          />
        );
      case "delivery":
        return (
          <LadderRow
            key={key}
            row={byKey.delivery}
            disagreementAction={fixFor("delivery")}
            {...railProps("delivery", "delivery", "Delivery Orders")}
          >
            <NestedConfig
              visible={shouldRenderConfig(
                rails.pickup || rails.delivery,
                dirtyLabels.includes("Orders"),
              )}
              label="Order channel"
            >
              <OrdersCard place={v} />
            </NestedConfig>
          </LadderRow>
        );
      case "reservations":
        return (
          <LadderRow
            key={key}
            row={byKey.reservations}
            disagreementAction={fixFor("reservations")}
          >
            <NestedConfig
              visible={shouldRenderConfig(true, dirtyLabels.includes("Reservations"))}
              label="Reservation channel"
            >
              <ReservationsCard place={v} />
            </NestedConfig>
          </LadderRow>
        );
    }
  };

  // Rewards' own box — every pill state, and since MESITA-1900 it renders on
  // the view whose name it has always carried. Placed above the rows for a
  // non-member (the pitch, right under the door line) and below them for a
  // member (the rows are the point once you are in).
  const partnershipBody =
    zone === "rewards" ? (
      <PartnershipBody
        place={v}
        pillState={pillState}
        storedStrategy={storedStrategy}
        member={member}
        setupHref={setupHref}
        isOwner={isOwner}
        onRejoin={canRejoin ? () => void commitRejoin() : undefined}
        rejoinPending={rejoinBusy}
        rejoinError={rejoinError}
      />
    ) : null;

  const writable = painted.filter(
    (r) => r.state.kind !== "not_mine" && r.state.kind !== "soon",
  );
  const notYours = painted.filter(
    (r) => r.state.kind === "not_mine" || r.state.kind === "soon",
  );

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="zone-offerings">
        <p id="zone-offerings" className="text-foreground text-sm leading-snug">
          {summary}
        </p>
        {prereq && (
          <p className="text-muted-foreground mt-2 text-sm leading-snug">
            {prereq.text}
            {/* Only the SETUP fix carries a link; a re-join is this place's
                own door, and a link to the setup there would send a forfeited
                place to subscribe twice. The button for it lives in the
                Rewards box, which is why this line names WHO can press it
                rather than where it is — the same engine paints six zones and
                only one of them carries that box. */}
            {prereq.action === "setup" && (
              <>
                {" "}
                <Link
                  href={setupHref}
                  className="text-foreground font-semibold underline underline-offset-4"
                >
                  Mesita Payments
                </Link>
              </>
            )}
          </p>
        )}
        {!member && partnershipBody && <div className="mt-4">{partnershipBody}</div>}
        <div className="mt-4 flex flex-col">
          {writable.map((r) => rowNode(r.key))}
          {notYours.length > 0 && (
            <>
              <div className="border-border/60 mt-1 flex items-center gap-3 border-t pt-3">
                <GroupLabel>Not yours to set</GroupLabel>
              </div>
              <div className="flex flex-col">
                {notYours.map((r) => rowNode(r.key))}
              </div>
            </>
          )}
        </div>

        {member && partnershipBody && <div className="mt-4">{partnershipBody}</div>}

        <p className="text-muted-foreground mt-3 border-t border-border/60 pt-3 text-xs leading-snug">
          {zone === "rewards"
            ? "Turning Visit Rewards on saves instantly. A strategy is confirmed in its card."
            : "Capability switches save instantly. Channel picks wait for Save."}
        </p>
      </section>

      {/* THE INTERNAL ZONE IS VISITS' NOW (MESITA-1885). It was Capabilities'
          alone, and Capabilities is five views; the box had to pick one rather
          than be split or repeated. It goes to Visits because that is what it
          is ABOUT — `VisitsCard` is how visits are run here — and because
          Visits is the container the other products attach to, which makes it
          the place's own room.

          IT STAYED WHEN THE PARTNERSHIP BODY LEFT (MESITA-1900). Rewards took
          `visit_rewards` and the box that prices it; this one is about how
          visits are RUN, so it did not travel. With no rung left on the view,
          it is what Visits shows besides its one sentence — which is the true
          shape of a product that has never had a switch.

          `TeamSection` LEFT IT (MESITA-1892). MESITA-1885 put the team here
          and said in the same breath that the box "had to pick one rather than
          be split or repeated", because there was no place-level Settings page
          to put it on. There is one now, and who may open this place is what
          the word Settings covers — so the team is at `settings` and this box
          is how visits are run, which is the half that was always about Visits.

          The eyebrow says whose it is rather than repeating the page: the
          card's own title already says what this is. */}
      {zone === "visits" && (
        <section aria-labelledby="zone-internal">
          <div className="mb-2.5 px-1">
            <GroupLabel>
              <span id="zone-internal">Internal</span>
            </GroupLabel>
          </div>
          <SectionCard
            icon={<SlidersHorizontal className="h-4 w-4" />}
            tint="slate"
            title="How this place is run"
            subtitle="Internal — nothing here is something a guest can do."
          >
            <div className="divide-border/60 mt-2 flex flex-col divide-y">
              <VisitsCard place={v} />
            </div>
          </SectionCard>
        </section>
      )}

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          state={promoCardState({
            member,
            forfeited,
            storedStrategy,
            cardId: modalStrategy.id,
            paid: modalStrategy.id !== ZERO_STRATEGY_ID,
          })}
          member={member}
          busy={switchPending}
          error={null}
          onConfirm={() => {
            if (!member || forfeited) return;
            commitSwitch(modalStrategy.id);
          }}
          onClose={() => setModalId(null)}
        />
      )}

      <div aria-live="polite">
        {switchError && <ErrorNote message={switchError} />}
      </div>
    </div>
  );
}
