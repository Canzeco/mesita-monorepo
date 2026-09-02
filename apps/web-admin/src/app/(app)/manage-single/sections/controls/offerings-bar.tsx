"use client";

import { type ReactNode } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { type AdminPlace, type PlaceRails } from "../../actions";
import {
  PROMOTION_SCORE_MAX,
  promotionScore,
} from "@/lib/business/promotion-score";
import { OPERATOR_PROMOTING_LABEL } from "@/lib/status-vocabulary";
import { placeOperatorPromotingLevel } from "../StatusCard";
import { SectionCard } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { cx } from "./shared";

// The Offerings bar. Moved verbatim out of PromosSection.tsx on 2026-09-02
// (file split, no behaviour change).

// ─── Box 1 · Offerings — the bar over what the place offers ───────────────────────────
//
// "Offerings" names the BAR (Pato, 2026-08-30) — "promo" is out of copy. The
// score is the shared 0–7 derivation (promotion-score.ts twins): Partnership
// +1 · Visit Rewards +0/1/2 · each accepted rail +1. Components render as
// rows; the four rail rows are live toggles writing the acceptance intent
// bits through admin-web-set-place-rails. Engines still gate each rail — a
// toggle records what the place OFFERS, and honest row copy says so.
// Display-only: the score never feeds discovery. Rank is never for sale.

const RAIL_ROWS: readonly {
  key: keyof PlaceRails;
  label: string;
  detail: string;
}[] = [
  {
    key: "mesita_pay",
    label: "Accept Mesita Pay",
    detail: "Guests pay the bill by card, inside Mesita.",
  },
  {
    key: "credits",
    label: "Accept Mesita Credits",
    detail: "Credits settle as a bill discount, never a payment.",
  },
  {
    key: "pickup",
    label: "Pickup Orders",
    detail: "Guests order ahead and pick up.",
  },
  {
    key: "delivery",
    label: "Delivery Orders",
    detail: "Guests order for delivery.",
  },
];

export function PromosBar({
  place,
  member,
  railBusy,
  railError,
  onToggle,
}: {
  place: AdminPlace;
  member: boolean;
  railBusy: keyof PlaceRails | null;
  railError: string | null;
  onToggle: (key: keyof PlaceRails, next: boolean) => void;
}) {
  const level = placeOperatorPromotingLevel(place);
  const rails: Record<keyof PlaceRails, boolean> = {
    mesita_pay: place.mesita_pay_enabled === true,
    credits: place.credits_enabled === true,
    pickup: place.pickup_orders_enabled === true,
    delivery: place.delivery_orders_enabled === true,
  };
  const score = promotionScore({
    partner: member,
    visitRewardsLevel: level,
    mesitaPay: rails.mesita_pay,
    credits: rails.credits,
    pickup: rails.pickup,
    delivery: rails.delivery,
  });

  return (
    <SectionCard
      icon={<TrendingUp className="h-4 w-4" />}
      tint="violet"
      title="Offerings"
      subtitle="Everything this place offers through Mesita."
      action={
        <span className="type-label text-foreground font-semibold tabular-nums">
          {score} / {PROMOTION_SCORE_MAX}
        </span>
      }
    >
      <div
        className="bg-muted mt-4 h-1.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Offerings ${score} of ${PROMOTION_SCORE_MAX}`}
      >
        <div
          className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
          style={{ width: `${(score / PROMOTION_SCORE_MAX) * 100}%` }}
        />
      </div>

      <div className="divide-border/60 mt-2 flex flex-col divide-y">
        <BarRow
          label="Partnership Subscription"
          detail="The first step — join in the box below."
          points={member ? "+1" : ""}
          earned={member}
          control={
            <span
              className={cx(
                "inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold",
                member
                  ? "bg-green-500/10 text-green-700"
                  : "text-muted-foreground bg-muted",
              )}
            >
              {member ? "Partner" : "Not yet"}
            </span>
          }
        />
        <BarRow
          label="Visit Rewards"
          detail="Zero · Conservative · Aggressive."
          points={level > 0 ? `+${level}` : ""}
          earned={level > 0}
          control={
            <span
              className={cx(
                "inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold",
                level > 0
                  ? "bg-green-500/10 text-green-700"
                  : "text-muted-foreground bg-muted",
              )}
            >
              {OPERATOR_PROMOTING_LABEL[level]}
            </span>
          }
        />
        {RAIL_ROWS.map((row) => (
          <BarRow
            key={row.key}
            label={row.label}
            detail={row.detail}
            points={rails[row.key] ? "+1" : ""}
            earned={rails[row.key]}
            control={
              <RailToggle
                on={rails[row.key]}
                busy={railBusy === row.key}
                disabled={railBusy !== null && railBusy !== row.key}
                label={row.label}
                onChange={(next) => onToggle(row.key, next)}
              />
            }
          />
        ))}
        <BarRow
          label="Mesita Capital"
          detail="Working-capital advances."
          points=""
          earned={false}
          control={
            <span className="text-muted-foreground bg-muted inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold">
              Soon
            </span>
          }
        />
      </div>

      <div aria-live="polite">
        {railError && (
          <div className="mt-3">
            <ErrorNote message={railError} />
          </div>
        )}
      </div>

      <p className="text-muted-foreground mt-3 text-xs leading-snug">
        A display score for oversight — it never buys rank. Each rail goes
        live with its engine; the toggles record what the place offers.
      </p>
    </SectionCard>
  );
}

function BarRow({
  label,
  detail,
  points,
  earned,
  control,
}: {
  label: string;
  detail: string;
  points: string;
  earned: boolean;
  control?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{detail}</p>
      </div>
      <span
        className={cx(
          "type-label w-6 shrink-0 text-right font-semibold tabular-nums",
          earned ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {points}
      </span>
      {control}
    </div>
  );
}

function RailToggle({
  on,
  busy,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy || disabled}
      onClick={() => onChange(!on)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        on ? "bg-secondary" : "bg-muted-foreground/25",
        (busy || disabled) && "cursor-default opacity-60",
      )}
    >
      <span
        className={cx(
          "bg-background inline-flex h-5 w-5 transform items-center justify-center rounded-full shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {busy && (
          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
        )}
      </span>
    </button>
  );
}

