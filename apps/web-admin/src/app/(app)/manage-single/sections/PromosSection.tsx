"use client";

import { useState, useTransition } from "react";
import { Loader2, Percent } from "lucide-react";
import {
  STRATEGY_BY_ID,
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { planForSubscription } from "@/lib/business/plans";
import {
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
import { ConfirmDialog, SectionCard } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import {
  isMemberPlan,
  membershipPillState,
  promoCardState,
} from "./promo-state";
import { PromosBar } from "./controls/offerings-bar";
import { MembershipBox } from "./controls/partnership";
import { ProductModal, StrategyCard } from "./controls/strategy-cards";
import {
  pickerStrategies,
  strategySwitchPatch,
  ZERO_STRATEGY_ID,
} from "./controls/shared";

// Admin Controls tab — SEVEN boxes (Pato live 2026-09-01). The Tutorial box was
// DELETED: this is the operator's own console, and it explained Mesita to the
// person who built it, in copy the other boxes already carried. Never restore
// it here — the business console is where a partner gets taught.
//   1. Offerings — the PROGRESS BAR over what the place offers: the
//      0–7 score summing what the place offers, its components as rows.
//      Partnership is the first step; the four rail rows are LIVE TOGGLES
//      (admin-web-set-place-rails); Mesita Capital is a locked Soon row.
//      Display-only — never a discovery input; rank is never for sale.
//      NAMING (Pato, 2026-08-30): "promo" and "membership" are OUT of
//      copy. The box and the catalog column are both "Offerings"; the
//      wire key stays `promotion` and the module stays promotion-score.ts
//      — labels move, wire keys never follow.
//   2. Partnership — MX$1,000/month is the subscription. Stripe-look mock
//      Join writes plan=pro at Zero (admin-web-set-plan, no charge).
//      Strategy unlocks after. Lifecycle rail, status pill, drop.
//   3. Visit Rewards — Zero · Conservative · Aggressive tiles. Give and
//      placement are a Low · Mid · High word ladder. Dominant is not a
//      picker option.
//   4-6. Visits · Orders · Reservations — the three rail boxes, MOVED here
//      from Settings (Pato live 2026-08-30): each configures a capability
//      the place offers through Mesita, so they sit with the offerings. One
//      box per rail still holds (MESITA-1148); Visits still carries the Check
//      PIN (MESITA-823) and the bill is still always required (MESITA-1095).
//   7. Team — the last box Settings still owned, folded in when Partnership
//      and Settings became ONE tab (Pato live 2026-09-01). People are a
//      control like any other: this tab is now everything the place is SET
//      to, and there is no second tab left to split it across.

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  // Write-through / optimistic — no draft dirtyMap (E-R0). Strategy SWITCH
  // stays optimistic (rates-only; the moving ring is the feedback).
  // Membership writes — join, drop — are PESSIMISTIC: they apply on EF
  // success only. Switch is optimistic. Join errors land on Partnership;
  // switch errors under the strategy grid; drop errors in the confirm.

  const [switchPending, startSwitch] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [railBusy, setRailBusy] = useState<keyof PlaceRails | null>(null);
  const [railError, setRailError] = useState<string | null>(null);

  const member = isMemberPlan(v.plan);
  const pillState = membershipPillState(v);
  const storedStrategy = strategyForPlace(v);
  const forfeited = pillState === "forfeited";

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };

  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
  };

  // Partnership join is its own door (setPlacePlan at Zero). The EF clears
  // the forfeit stamp + strikes on re-grant. Strategy is a later switch.
  const commitJoinPartnership = async () => {
    if (joinBusy || (member && !forfeited)) return;
    const rates = strategySwitchPatch(ZERO_STRATEGY_ID, v, storedStrategy);
    const plan = planForSubscription("pro_discount");

    setJoinBusy(true);
    setJoinError(null);
    const r = await setPlacePlan(v.id, plan, rates);
    setJoinBusy(false);
    if (!r.ok) {
      setJoinError(r.error);
      return;
    }
    applyPlace(r.data);
  };

  const commitDrop = async () => {
    if (dropBusy || !member) return;
    const rates = strategySwitchPatch(ZERO_STRATEGY_ID, v, storedStrategy);
    const plan = planForSubscription("free");

    setDropBusy(true);
    setDropError(null);
    const r = await setPlacePlan(v.id, plan, rates);
    setDropBusy(false);
    if (!r.ok) {
      setDropError(r.error);
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
    const optimistic: AdminPlace = { ...v, ...rates };
    applyPlace(optimistic);
    setSwitchError(null);

    startSwitch(async () => {
      const r = await setPlaceStrategy(prev.id, rates);
      if (!r.ok) {
        revertPlace(prev);
        setSwitchError(r.error);
        return;
      }
      applyPlace(r.data);
    });
  };

  // Rail toggles — optimistic per-toggle with revert, mirroring the strategy
  // switch. One rail writes at a time; the response's post-write truth is
  // merged so a concurrent flip elsewhere cannot leave a stale bit.
  const RAIL_COLUMN = {
    mesita_pay: "mesita_pay_enabled",
    credits: "credits_enabled",
    pickup: "pickup_orders_enabled",
    delivery: "delivery_orders_enabled",
  } as const;

  const commitRail = async (key: keyof PlaceRails, next: boolean) => {
    if (railBusy) return;
    const prev = v;
    const optimistic: AdminPlace = { ...v, [RAIL_COLUMN[key]]: next };
    applyPlace(optimistic);
    setRailBusy(key);
    setRailError(null);
    const r = await setPlaceRails(prev.id, { [key]: next });
    setRailBusy(null);
    if (!r.ok) {
      revertPlace(prev);
      setRailError(r.error);
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

  const onCardOpen = (id: StrategyId) => {
    setModalId(id);
  };

  const onModalConfirm = (target: StrategyId) => {
    if (!member || forfeited) return;
    commitSwitch(target);
  };

  const onModalClose = () => {
    setModalId(null);
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;

  return (
    <div className="flex flex-col gap-4">
      <PromosBar
        place={v}
        member={member}
        railBusy={railBusy}
        railError={railError}
        onToggle={(key, next) => void commitRail(key, next)}
      />

      <MembershipBox
        place={v}
        pillState={pillState}
        storedStrategy={storedStrategy}
        member={member}
        joinBusy={joinBusy}
        joinError={joinError}
        onJoinClick={() => void commitJoinPartnership()}
        onDropClick={() => {
          setDropError(null);
          setDropOpen(true);
        }}
      />

      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="amber"
        title="Visit Rewards"
        subtitle="Zero · Conservative · Aggressive — orders and prepaid stay off."
        action={
          switchPending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : undefined
        }
      >
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              onOpen={() => onCardOpen(s.id)}
            />
          ))}
        </div>

        {(storedStrategy === null || storedStrategy === "dominant") && member && (
          <p className="text-muted-foreground mt-2.5 type-label">
            Current rates don&apos;t match a strategy — pick one to standardize.
          </p>
        )}

        {/* Always-mounted live region: a region that mounts together with its
            message does not announce. Switch errors land here, beside the
            gesture; join/drop errors live in their modal/dialog. */}
        <div aria-live="polite">
          {switchError && (
            <div className="mt-3">
              <ErrorNote message={switchError} />
            </div>
          )}
        </div>
      </SectionCard>

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          currency={v.currency}
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
          onConfirm={() => onModalConfirm(modalStrategy.id)}
          onClose={onModalClose}
        />
      )}

      {/* The three rail boxes, moved here from Settings (Pato live
          2026-08-30). Each configures a capability the place offers
          through Mesita, so they sit right after the offerings. One box
          per rail still holds (MESITA-1148); Visits still carries the
          Check PIN. */}
      <VisitsCard place={v} />
      <OrdersCard place={v} />
      <ReservationsCard place={v} />

      {/* Team — folded in from Settings when the two tabs merged (Pato live
          2026-09-01). Last box on purpose: the offerings and rails are what
          the place sells, people are who runs it. */}
      <TeamSection place={v} />

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

