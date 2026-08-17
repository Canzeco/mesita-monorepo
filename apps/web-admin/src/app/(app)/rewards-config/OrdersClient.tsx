"use client";

import { Coins, Gift, Info, Percent } from "lucide-react";

import { SectionCard } from "../enricher-config/atlas-ui";
import { BoxRow, RateSelect, SoonPill, StrategyHeads } from "./promos-ui";
import { usePromosState } from "./PromosState";
import {
  ALLOWED_CAPS,
  BONUS_META,
  PLAN_KEYS,
  PLAN_META,
  STRATEGY_KEYS,
  STRATEGY_META,
} from "./promos";

// Orders — the remote ladder. FOUR boxes, not five: there is no Class box at
// all, because class prices PRESENCE and a delivery order has nobody in the
// chair (Notion §2.8). Rendering it disabled would imply it might one day
// resolve here; it will not.
//
// PARKED. The knobs are live and saved, but no ticket carries a remote context
// yet, so nothing reads these rates. Following the Ojo Config precedent, the
// console keeps saying so rather than hiding the section.

const STRATEGY_NAMES = STRATEGY_KEYS.map((s) => STRATEGY_META[s].name);

export function OrdersClient() {
  const { cfg, orders, setOrders, setBonus, setCap, pending } = usePromosState();

  const setBase = (s: (typeof STRATEGY_KEYS)[number], v: number) =>
    setOrders({ ...orders, [s]: { ...orders[s], base: v } });
  const setPlan = (s: (typeof STRATEGY_KEYS)[number], v: number) =>
    setOrders({
      ...orders,
      [s]: { ...orders[s], plan: { ...orders[s].plan, premium: v } },
    });

  return (
    <div className="space-y-5">
      <p className="border-border bg-muted/50 text-muted-foreground flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="text-foreground font-semibold">
            Orders knobs are staged.
          </span>{" "}
          They save to the live config, but no ticket carries a remote context
          yet, so nothing reads them and no order has ever been discounted. Tune
          them now and they take effect the day the remote bill path ships.
        </span>
      </p>

      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title="Base reward · the floor"
        subtitle="What every guest gets on a pickup or delivery order. Class does not appear here — presence is what class buys, and nobody is in the chair."
        status={<SoonPill />}
      >
        <div className="bg-muted/40 border-border/70 mt-4 rounded-xl border p-3">
          <StrategyHeads names={STRATEGY_NAMES} />
          <BoxRow label="Standing rate">
            {STRATEGY_KEYS.map((s) => (
              <RateSelect
                key={s}
                value={orders[s].base}
                disabled={pending}
                ariaLabel={`${STRATEGY_META[s].name} order base standing rate`}
                onChange={(v) => setBase(s, v)}
              />
            ))}
          </BoxRow>
        </div>
        <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
          A flatter, lower band than visits by design: remote buys volume, and
          the discount is funded out of the 25–30% a delivery app would have
          taken from the same order.
        </p>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SectionCard
          icon={<Gift className="text-secondary h-4 w-4" />}
          title="+ Welcome"
          subtitle="One-time, on the guest's first verified ticket at the place."
          status={<SoonPill />}
        >
          <div className="mt-3">
            <BoxRow
              label={BONUS_META.welcome.name}
              emoji={BONUS_META.welcome.emoji}
              hint={BONUS_META.welcome.qualifier}
            >
              <RateSelect
                value={cfg.orders.bonuses.welcome}
                disabled={pending}
                signed
                ariaLabel="Welcome bonus on an order, adds"
                onChange={(v) => setBonus("orders", "welcome", v)}
              />
            </BoxRow>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Percent className="text-secondary h-4 w-4" />}
          title="+ Plan"
          subtitle="The one rung that follows the guest everywhere — it is what they pay Mesita for."
          status={<SoonPill />}
        >
          <div className="mt-3">
            <StrategyHeads names={STRATEGY_NAMES} />
            {PLAN_KEYS.map((k) => (
              <BoxRow key={k} label={PLAN_META[k].name} emoji={PLAN_META[k].emoji}>
                {STRATEGY_KEYS.map((s) => (
                  <RateSelect
                    key={s}
                    value={orders[s].plan[k]}
                    disabled={pending}
                    signed
                    pinned={k === "free"}
                    ariaLabel={`${STRATEGY_META[s].name} ${PLAN_META[k].name} order plan bonus, adds`}
                    onChange={(v) => setPlan(s, v)}
                  />
                ))}
              </BoxRow>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={<Gift className="text-secondary h-4 w-4" />}
          title="+ Actions"
          subtitle="All three sharing actions run remotely too — a story about a delivered dinner is reach all the same."
          status={<SoonPill />}
        >
          <div className="mt-3">
            {(["story", "mesita", "google"] as const).map((k) => (
              <BoxRow
                key={k}
                label={BONUS_META[k].name}
                emoji={BONUS_META[k].emoji}
                hint={BONUS_META[k].qualifier}
              >
                <RateSelect
                  value={cfg.orders.bonuses[k]}
                  disabled={pending}
                  signed
                  ariaLabel={`${BONUS_META[k].name} bonus on an order, adds`}
                  onChange={(v) => setBonus("orders", k, v)}
                />
              </BoxRow>
            ))}
          </div>
        </SectionCard>

        {/* The cap belongs to neither context exclusively — it applies to both,
            so it lives with the shared document rather than on Visits. */}
        <SectionCard
          icon={<Coins className="text-secondary h-4 w-4" />}
          title="Default discount cap"
          subtitle="Fallback when a place has not picked its own cap. Applies to visits and orders alike."
        >
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {ALLOWED_CAPS.map((c) => {
              const active = cfg.cap === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={pending}
                  onClick={() => setCap(c)}
                  aria-pressed={active}
                  className={
                    active
                      ? "bg-foreground text-background inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-bold tabular-nums transition disabled:opacity-50"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3.5 text-[13px] font-semibold tabular-nums transition disabled:opacity-50"
                  }
                >
                  <Coins className="mr-1.5 h-3.5 w-3.5" />
                  {c.toLocaleString("en-US")}
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            The discount applies to the first{" "}
            <span className="text-foreground font-semibold">
              MX${cfg.cap.toLocaleString("en-US")}
            </span>{" "}
            of the bill.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
