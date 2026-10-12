"use client";

// Plan — the plan you are on, and what each plan includes (MESITA-2134,
// MESITA-2167). Opened from the Me › Plan tile.
//
// READ-ONLY BY DESIGN. The Premium checkout left with the subscription Edge
// Functions in the First Stage cut (MESITA-2090), so there is nothing to buy
// here today. Every account is on Free, and Premium wears the same "Soon"
// tag as the Pay tab, so the two make one promise. When a subscription EF
// exists again, the Premium row becomes the action.
//
// PREMIUM STATES NO NUMBER AND NO PRICE. "More reservations" is Pato's
// promise (MESITA-2167); the connector was decided Premium-only in MESITA-266.
// How many reservations and for how much are not decided, so the page must not
// invent either. (MESITA-1127's old Premium figures are superseded.) Free's
// perks are checks because they are true today; Premium's are dots, so a
// quick scan does not read an unbuilt perk as included.

import { Check, Sparkles } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { FREE_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";
import { IconCircle, RowDivider, SettingsGroup } from "./settings-rows";

function Perks({
  label,
  items,
  included,
}: {
  label: string;
  items: string[];
  included: boolean;
}) {
  return (
    <ul role="list" aria-label={label} className="mt-2 flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="text-foreground type-body flex items-start gap-2"
        >
          {included ? (
            <Check
              className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden
            />
          ) : (
            <span
              className="bg-muted-foreground/40 mt-[0.45rem] ml-1 h-1.5 w-1.5 shrink-0 rounded-full"
              aria-hidden
            />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanModal() {
  return (
    <MeScreen title="Plan">
      <SettingsGroup>
        <div className="flex items-start gap-3 px-4 py-3">
          <IconCircle tint="primary">
            <Check className="h-[18px] w-[18px]" />
          </IconCircle>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Free</span>
            <span className="text-muted-foreground type-label block">
              Your plan.
            </span>
            <Perks
              label="Included in Free"
              included
              items={[
                "Browse and save places",
                "Mesita calls the place to book your table",
                `${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
              ]}
            />
          </div>
        </div>
        <RowDivider />
        <div className="flex items-start gap-3 px-4 py-3">
          <IconCircle tint="muted">
            <Sparkles className="h-[18px] w-[18px]" />
          </IconCircle>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Premium</span>
            <span className="text-muted-foreground type-label block">
              The paid plan, coming to Mesita.
            </span>
            <Perks
              label="Coming with Premium"
              included={false}
              items={[
                "More reservations every month",
                "Use Mesita from your AI assistant (MCP connector)",
              ]}
            />
          </div>
          <span className="bg-muted text-muted-foreground type-meta rounded-full px-2 py-0.5 font-semibold">
            Soon
          </span>
        </div>
      </SettingsGroup>
    </MeScreen>
  );
}
