"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import {
  STRATEGY_BY_ID,
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { useOpenPlace } from "@/components/console/OpenPlace";
import { SHELL_ROUTES, orgHref as orgPageHref } from "@/lib/console-routes";
import {
  getPlacePaymentAccount,
  setPlaceRails,
  setPlaceStrategy,
  type AdminPlace,
  type PlaceRails,
} from "../actions";
import { OrdersCard } from "./OrdersCard";
import { ReservationsCard } from "./ReservationsCard";
import { TeamSection } from "./TeamSection";
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
  rowsForZone,
  shouldRenderConfig,
  topPrerequisite,
  type ConnectState,
  type LadderRowKey,
  type LadderZone,
} from "./controls/offerings";
import { pickerStrategies, strategySwitchPatch, ZERO_STRATEGY_ID } from "./controls/shared";

// The place's ladder — rendered ONCE per zone (MESITA-1841).
//
// ONE ENGINE, TWO VIEWS. `zone` selects which rungs and which trailing blocks
// this renders: Capabilities is what a guest CAN do here plus the internal
// "How this place is run" box; Rewards is what a guest EARNS — Visit Rewards,
// its strategy ladder, and the Partnership body that prices it. The rungs
// depend on one another (Partner unlocks Visit Rewards and Mesita Pay; Stripe
// unlocks the money rungs), so the COMPUTATION is never split — two copies of
// a dependency ladder is two copies that can disagree. `ZONE_ROWS` in
// controls/offerings.ts owns the mapping and a test proves it is total.
//
// MESITA-1739 first paint: summary of what guests can do, then the one
// prerequisite that unlocks the most rows, then the rows. The 0–7 meter
// left — ProfileCompleteness owns the meter where it belongs, and a
// coincidence with §11.2's seven capabilities is still a coincidence.
// Partnership is a PlaceHeading chip + one line; Partner and Stripe
// live on Organization. Nested configs stay MOUNTED (shouldRenderConfig).

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
  // "Organization for Stripe" is a door to the holder's organization page,
  // where the Stripe Account box lives. The holder is published by the place
  // layout (MESITA-1807); before it lands, the root resolver answers for it.
  const holderOrgId = useOpenPlace()?.holderOrgId ?? null;
  const orgHref = holderOrgId ? orgPageHref(holderOrgId) : SHELL_ROUTES.root;

  const [switchPending, startSwitch] = useTransition();
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
  };
  const rows = offeringRows(ladderInput);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  // THE ZONE'S ROWS, not the ladder's. `rows` stays whole — `topPrerequisite`
  // and the rail toggles below read the full ladder — and only what is PAINTED
  // narrows, so the summary line describes the view you are actually on.
  const zoneRows = rowsForZone(rows, zone);
  const painted = paintRows(zoneRows);
  const summary = guestSummary(zoneRows);
  const prereq = topPrerequisite(ladderInput);

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };
  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
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
    if (d.fix === "organization") {
      return (
        <Link
          href={orgHref}
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
            {...railProps("mesita_pay", "mesita_pay", "Mesita Pay")}
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
        {prereq?.action === "organization" && (
          <p className="text-muted-foreground mt-2 text-sm leading-snug">
            {prereq.text}{" "}
            <Link
              href={orgHref}
              className="text-foreground font-semibold underline underline-offset-4"
            >
              Organization
            </Link>
          </p>
        )}
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

        {member && zone === "rewards" && (
          <div className="mt-4">
            <PartnershipBody
              place={v}
              pillState={pillState}
              storedStrategy={storedStrategy}
              member={member}
              orgHref={orgHref}
            />
          </div>
        )}

        <p className="text-muted-foreground mt-3 border-t border-border/60 pt-3 text-xs leading-snug">
          {zone === "capabilities"
            ? "Capability switches save instantly. Channel picks wait for Save."
            : "Turning Visit Rewards on saves instantly. A strategy is confirmed in its card."}
        </p>
      </section>

      {/* THE INTERNAL ZONE IS CAPABILITIES' ALONE (MESITA-1841). It was headed
          "Settings" while the page was called Settings; the page is
          Capabilities again and the card's own title already says what this
          is, so the eyebrow says whose it is instead of repeating the page. */}
      {zone === "capabilities" && (
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
              <TeamSection place={v} />
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
