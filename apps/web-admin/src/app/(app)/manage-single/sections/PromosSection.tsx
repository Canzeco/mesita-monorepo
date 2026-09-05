"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, TrendingUp } from "lucide-react";
import {
  STRATEGY_BY_ID,
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { planForSubscription } from "@/lib/business/plans";
import {
  CONNECT_COUNTRIES,
  getPlacePaymentAccount,
  getPlacePaymentDashboardLink,
  reviewTicketReport,
  startPlacePaymentOnboarding,
  setPlacePlan,
  setPlaceRails,
  setPlaceStrategy,
  type AdminPlace,
  type MesitaConnectCountry,
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
  promoCardState,
} from "./promo-state";
import { placeOperatorPromotingLevel } from "./StatusCard";
import { PartnershipBody, MembershipStatusPill } from "./controls/partnership";
import { ProductModal, StrategyCard } from "./controls/strategy-cards";
import { LadderRow, NestedConfig } from "./controls/ladder-row";
import {
  connectStartFailure,
  connectStateFrom,
  controlWriteFailure,
  offeringRows,
  PROMOTION_SCORE_MAX,
  railWriteFailure,
  shouldRenderConfig,
  STRIPE_LIVE_BLOCKED,
  type ConnectState,
  type LadderRowKey,
} from "./controls/offerings";
import { pickerStrategies, strategySwitchPatch, ZERO_STRATEGY_ID } from "./controls/shared";

// Admin Controls tab — TWO ZONES (Pato live 2026-09-02).
//
//   OFFERINGS — what a guest can do at this place through Mesita, as a
//               DEPENDENCY LADDER. The 0–7 meter is the zone header, not a
//               card: PlaceEditChrome already carries the place name and the
//               Partnered chip on every tab, and Profile already owns a meter
//               in ProfileCompleteness, so a second one here would be chrome
//               competing with chrome.
//   SETTINGS  — how the place is RUN. Staff PIN, Team. Quieter on purpose.
//
// That rule — "what a guest can do" vs "how it is run" — is what puts
// Reservations in Offerings despite scoring zero, and the staff PIN in
// Settings despite gating a guest-facing flow. Do not re-derive it from the
// score: promotionScore counts six of the nine rows, which is exactly why
// every row carries a points cell.
//
// Seven cards became two zones. The ladder itself lives in controls/offerings.ts
// (pure, node-tested); this file is composition and writes only.

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  const { dirtyLabels } = usePlaceContext();

  // Write-through / optimistic — no draft dirtyMap. Strategy SWITCH stays
  // optimistic (rates-only; the moving ring is the feedback). Membership
  // writes — join, drop — are PESSIMISTIC: they apply on EF success only.
  const [switchPending, startSwitch] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [railBusy, setRailBusy] = useState<keyof PlaceRails | null>(null);
  // Per-ROW, so the reason lands beside the switch that failed rather than at
  // the foot of the card, where it used to sit.
  const [rowError, setRowError] = useState<
    { key: LadderRowKey; message: string } | null
  >(null);

  // The Connect mirror. Read-only here; onboarding is its own PR. Refresh-on-
  // read, because the webhook endpoint's dashboard setup is a human step and
  // must never be a dependency.
  const [connect, setConnect] = useState<ConnectState>({ kind: "none" });
  const [connectLoading, setConnectLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void getPlacePaymentAccount(place.id, { refresh: true }).then((r) => {
      if (!alive) return;
      setConnectLoading(false);
      // A failed read is NOT "no account" — but the ladder cannot unlock a
      // rung it cannot verify, so `none` is the safe reduction either way.
      if (r.ok) setConnect(connectStateFrom(r.data.account, r.data.orphaned));
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  // Asked, not derived (gate D2, 2026-09-05). `places.country` holds Google's
  // display text ("México"), and deriving it was rejected: no mapping layer,
  // no fallback when the text is unexpected, and the operator should look at
  // this every time because Stripe bakes it into the account PERMANENTLY.
  const [connectCountry, setConnectCountry] = useState<MesitaConnectCountry>("MX");
  const [dashboardBusy, setDashboardBusy] = useState(false);

  // Opens the Express Dashboard. New tab, NOT a full navigation like the
  // onboarding redirect: onboarding has to come back to returnUrl, whereas
  // this is a side trip and losing the console page would be rude.
  const openDashboard = async () => {
    if (dashboardBusy) return;
    setDashboardBusy(true);
    setConnectError(null);
    const r = await getPlacePaymentDashboardLink(place.id);
    setDashboardBusy(false);
    if (!r.ok) {
      console.error("[controls] getPlacePaymentDashboardLink failed:", r.error);
      setConnectError(connectStartFailure(r.code ?? null, r.error ?? null));
      return;
    }
    if (r.data.url) window.open(r.data.url, "_blank", "noopener,noreferrer");
  };
  // Latched by an environment-level refusal (STRIPE_LIVE_BLOCKED), never by a
  // transient one: the button goes quiet while `connectError` keeps saying
  // why. Scoped to this mount on purpose — the next place re-asks rather than
  // inheriting a verdict this component never re-verified.
  const [connectRefused, setConnectRefused] = useState(false);

  // Stripe owns the next screen, so this is a FULL navigation, not a new tab —
  // the hosted Account Link expects to come back to `returnUrl` in the same
  // context. Returning re-mounts this component, and the effect above re-reads
  // the mirror with refresh:true, so no explicit ?connect= handling is needed.
  const startConnect = async () => {
    if (connectBusy) return;
    setConnectBusy(true);
    setConnectError(null);
    const base = `${window.location.origin}/manage-single/${place.id}/promos`;
    const r = await startPlacePaymentOnboarding(place.id, {
      returnUrl: `${base}?connect=return`,
      refreshUrl: `${base}?connect=refresh`,
      country: connectCountry,
    });
    if (!r.ok) {
      setConnectBusy(false);
      console.error("[controls] startPlacePaymentOnboarding failed:", r.error);
      setConnectError(connectStartFailure(r.code ?? null, r.error ?? null));
      // The live-charge block belongs to the environment, so it holds for
      // every place and every retry. Stop offering an action that cannot
      // succeed — the same rule the non-partner row already follows.
      if (r.code === STRIPE_LIVE_BLOCKED) setConnectRefused(true);
      return;
    }
    // The place already had an account in another country. The link is real
    // and points at THAT account — country is permanent, so nothing was
    // changed to match the request. Say so instead of redirecting silently
    // into an onboarding flow for a country the operator did not choose.
    if (r.data.countryMismatch) {
      setConnectBusy(false);
      setConnectError(
        `This place already has a ${r.data.accountCountry ?? "different"} Stripe account, so ${connectCountry} was not applied. A country can't be changed after the account exists — delete it at Stripe first.`,
      );
      return;
    }
    if (r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    // Mock mode: no hosted page exists, so reflect the new row in place.
    setConnectBusy(false);
    setConnect(connectStateFrom(r.data.account, false));
  };

  // Ghost-partner hold restore (MESITA-1311, arrived on main mid-rebuild):
  // the review ended, so the reward lane reopens to whatever the strike
  // ladder already says. The EF returns only the cleared hold.
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

  const rails: Record<keyof PlaceRails, boolean> = {
    mesita_pay: v.mesita_pay_enabled === true,
    credits: v.credits_enabled === true,
    pickup: v.pickup_orders_enabled === true,
    delivery: v.delivery_orders_enabled === true,
  };

  const rows = offeringRows({ member, visitRewardsLevel: level, rails, connect });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const score = rows.reduce((n, r) => n + (r.earned && r.points ? r.points : 0), 0);

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

  // Optimistic per-toggle with revert. One rail writes at a time; the
  // response's post-write truth is merged so a concurrent flip elsewhere
  // cannot leave a stale bit.
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
      // The operator gets a sentence they can act on; the raw Edge Function
      // error goes to the console, never the DOM.
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

  return (
    <div className="flex flex-col gap-7">
      {/* ══ ZONE 1 · OFFERINGS ══════════════════════════════════════════ */}
      <section aria-labelledby="zone-offerings">
        <div className="mb-2.5 flex items-end justify-between gap-4 px-1">
          <GroupLabel>
            <span id="zone-offerings">Offerings</span>
          </GroupLabel>
          <span className="type-label text-foreground font-semibold tabular-nums">
            {score} of {PROMOTION_SCORE_MAX}
          </span>
        </div>
        <div
          className="bg-muted mb-4 h-1.5 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={`Offerings ${score} of ${PROMOTION_SCORE_MAX}`}
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
            style={{ width: `${(score / PROMOTION_SCORE_MAX) * 100}%` }}
          />
        </div>

        <SectionCard
          icon={<TrendingUp className="h-4 w-4" />}
          tint="violet"
          title="What guests can do here"
          subtitle="Each rung unlocks the next. A row that cannot be turned on says what it needs."
          action={
            connectLoading ? (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            ) : undefined
          }
        >
          <div className="mt-4 flex flex-col">
            <LadderRow
              row={byKey.partnership}
              error={joinError}
              control={<MembershipStatusPill state={pillState} />}
            >
              <NestedConfig visible label="Subscription">
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
              </NestedConfig>
            </LadderRow>

            <LadderRow
              row={byKey.stripe}
              error={connectError}
              control={
                byKey.stripe.state.kind === "locked" ? undefined
                  : byKey.stripe.state.kind === "on" ? (
                    <button
                      type="button"
                      onClick={() => void openDashboard()}
                      disabled={dashboardBusy}
                      className="border-border inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                    >
                      {dashboardBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Open dashboard
                    </button>
                  ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Only before an account exists. Country is per-account
                        permanent, so re-offering it on "Finish setup" would be
                        a control that cannot do anything. */}
                    {byKey.stripe.state.kind === "off" && (
                      <select
                        aria-label="Country for this Stripe account"
                        value={connectCountry}
                        onChange={(e) =>
                          setConnectCountry(e.target.value as MesitaConnectCountry)}
                        disabled={connectBusy || connectLoading || connectRefused}
                        className="border-border bg-background h-9 shrink-0 rounded-full border px-3 text-sm disabled:opacity-50"
                      >
                        {CONNECT_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => void startConnect()}
                      disabled={connectBusy || connectLoading || connectRefused}
                      className="bg-foreground text-background inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                    >
                      {connectBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {byKey.stripe.state.kind === "off" ? "Connect Stripe" : "Finish setup"}
                    </button>
                  </div>
                )
              }
            />

            <LadderRow
              row={byKey.mesita_pay}
              {...railProps("mesita_pay", "mesita_pay", "Mesita Pay")}
            />

            <LadderRow
              row={byKey.visit_rewards}
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

            <LadderRow
              row={byKey.accept_prepays}
              {...railProps("credits", "accept_prepays", "Accept Prepays")}
            />

            <LadderRow row={byKey.sell_prepays} />

            <LadderRow row={byKey.pickup} {...railProps("pickup", "pickup", "Pickup Orders")} />

            <LadderRow
              row={byKey.delivery}
              {...railProps("delivery", "delivery", "Delivery Orders")}
            >
              {/* Kept MOUNTED and hidden with CSS: unmounting runs
                  registerSaver(section, null) and silently drops the draft.
                  Visible whenever dirty, so an unsaved edit is never invisible. */}
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

            <LadderRow row={byKey.reservations}>
              <NestedConfig
                visible={shouldRenderConfig(true, dirtyLabels.includes("Reservations"))}
                label="Reservation channel"
              >
                <ReservationsCard place={v} />
              </NestedConfig>
            </LadderRow>
          </div>

          <p className="text-muted-foreground mt-3 border-t border-border/60 pt-3 text-xs leading-snug">
            Switches save instantly. A display score for oversight — it never buys
            rank. Mesita Capital is not live yet.
          </p>
        </SectionCard>
      </section>

      {/* ══ ZONE 2 · SETTINGS ═══════════════════════════════════════════ */}
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
