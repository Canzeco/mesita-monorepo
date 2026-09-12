"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import {
  STRATEGY_BY_ID,
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { planForSubscription } from "@/lib/business/plans";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import {
  getPlacePaymentAccount,
  reviewTicketReport,
  setPlacePlan,
  setPlaceRails,
  setPlaceStrategy,
  type AdminPlace,
  type PlaceRails,
} from "../actions";
import { OrdersCard } from "./OrdersCard";
import { ReservationsCard } from "./ReservationsCard";
import { TeamSection } from "./TeamSection";
import { VisitsCard } from "./VisitsCard";
import { ConfirmDialog, GroupLabel, SectionCard } from "@/components/admin-ui/manage";
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
  shouldRenderConfig,
  topPrerequisite,
  type ConnectState,
  type LadderRowKey,
} from "./controls/offerings";
import { pickerStrategies, strategySwitchPatch, ZERO_STRATEGY_ID } from "./controls/shared";

// Capabilities (admin Controls tab — a rename that stops at the label).
//
// MESITA-1739 first paint: summary of what guests can do, then the one
// prerequisite that unlocks the most rows, then the rows. The 0–7 meter
// left — ProfileCompleteness owns the meter where it belongs, and a
// coincidence with §11.2's seven capabilities is still a coincidence.
// Partnership is a PlaceHeading chip + one line; Stripe onboards on
// Organization. Nested configs stay MOUNTED (shouldRenderConfig).

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  const { dirtyLabels } = usePlaceContext();
  const orgId = useSearchParams().get("org");
  const orgHref = withOrg(SHELL_ROUTES.organization, orgId);

  const [switchPending, startSwitch] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
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

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const commitRestore = async () => {
    if (restoreBusy) return;
    setRestoreBusy(true);
    setRestoreError(null);
    const r = await reviewTicketReport({ action: "restore", placeId: v.id });
    setRestoreBusy(false);
    if (!r.ok) {
      console.error("[controls] reviewTicketReport restore failed:", r.error);
      setRestoreError(controlWriteFailure("restore Visit Rewards"));
      return;
    }
    applyPlace({ ...v, reward_lane_pending_review_at: null });
  };

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
  const painted = paintRows(rows);
  const summary = guestSummary(rows);
  const prereq = topPrerequisite(ladderInput);

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };
  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
  };

  const commitJoinPartnership = async () => {
    if (joinBusy || (member && !forfeited)) return;
    const rates = strategySwitchPatch(ZERO_STRATEGY_ID, v, storedStrategy);
    setJoinBusy(true);
    setJoinError(null);
    const r = await setPlacePlan(v.id, planForSubscription("pro_discount"), rates);
    setJoinBusy(false);
    if (!r.ok) {
      console.error("[controls] setPlacePlan join failed:", r.error);
      setJoinError(controlWriteFailure("join the partnership"));
      return;
    }
    applyPlace(r.data);
  };

  const commitDrop = async () => {
    if (dropBusy || !member) return;
    const rates = strategySwitchPatch(ZERO_STRATEGY_ID, v, storedStrategy);
    setDropBusy(true);
    setDropError(null);
    const r = await setPlacePlan(v.id, planForSubscription("free"), rates);
    setDropBusy(false);
    if (!r.ok) {
      console.error("[controls] setPlacePlan drop failed:", r.error);
      setDropError(controlWriteFailure("drop the partnership"));
      return;
    }
    applyPlace(r.data);
    setDropOpen(false);
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
    if (d.fix === "join") {
      return (
        <button
          type="button"
          onClick={() => void commitJoinPartnership()}
          disabled={joinBusy}
          className="text-foreground font-semibold underline underline-offset-4"
        >
          {d.fixLabel}
        </button>
      );
    }
    if (d.fix === "restore") {
      return (
        <button
          type="button"
          onClick={() => void commitRestore()}
          disabled={restoreBusy}
          className="text-foreground font-semibold underline underline-offset-4"
        >
          {restoreBusy ? "Restoring…" : d.fixLabel}
        </button>
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
        {prereq?.action === "join" && (
          <p className="text-muted-foreground mt-2 text-sm leading-snug">
            {prereq.text}{" "}
            <button
              type="button"
              onClick={() => void commitJoinPartnership()}
              disabled={joinBusy}
              className="text-foreground font-semibold underline underline-offset-4"
            >
              {joinBusy ? "Joining…" : forfeited ? "Re-join" : "Join"}
            </button>
          </p>
        )}
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
        <div aria-live="polite">
          {joinError && (
            <div className="mt-2">
              <ErrorNote message={joinError} />
            </div>
          )}
        </div>

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

        {member && (
          <div className="mt-4">
            <PartnershipBody
              place={v}
              pillState={pillState}
              storedStrategy={storedStrategy}
              member={member}
              joinBusy={joinBusy}
              joinError={joinError}
              restoreBusy={restoreBusy}
              restoreError={restoreError}
              onRestoreClick={() => void commitRestore()}
              onJoinClick={() => void commitJoinPartnership()}
              onDropClick={() => {
                setDropError(null);
                setDropOpen(true);
              }}
            />
          </div>
        )}

        <p className="text-muted-foreground mt-3 border-t border-border/60 pt-3 text-xs leading-snug">
          Capability switches save instantly. Channel picks wait for Save.
        </p>
      </section>

      <section aria-labelledby="zone-settings">
        <div className="mb-2.5 px-1">
          <GroupLabel>
            <span id="zone-settings">Settings</span>
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

      <ConfirmDialog
        open={dropOpen}
        danger
        busy={dropBusy}
        error={dropError}
        title="Drop partnership?"
        body="Ends the partnership and clears activation — re-joining restarts pending activation. Strikes and any active pause carry over if the place re-joins."
        confirmLabel="Drop partnership"
        onConfirm={() => void commitDrop()}
        onCancel={() => {
          if (!dropBusy) {
            setDropOpen(false);
            setDropError(null);
          }
        }}
      />
    </div>
  );
}
