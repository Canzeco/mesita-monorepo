// The Mesita Pro card, shared by Me › Plan and the reserve flow's hidden Pro
// step (MESITA-4393; moved out of PlanModal, where MESITA-4385/4388 shaped
// it). The card keeps PlanModal's contract: `current` marks the guest's own
// plan and `children` is the action the caller needs (Upgrade, Renews ·
// Cancel Pro, Keep Pro, or nothing for granted Pro). UpgradeAction is the
// Free guest's action, the same on both screens.

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dollars, PLAN_ROWS } from "@/components/consumer/me/plan-words";
import { PRO_PRICE_CENTS, PRO_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";
import { cn } from "@/lib/utils";
import { ME_BUTTON_CLASS } from "./settings-rows";

/** Mesita's own pink, the brand gradient's two ends (assets/brand). The
 *  app's `bg-pink-gradient` was repainted ink when it went achromatic, so
 *  Pro reads the brand tokens directly: Pro is the one coloured product on
 *  Me (MESITA-4385, Pato: "add colors. must look like fucking products"). */
export const PRO_GRADIENT_CLASS =
  "bg-[linear-gradient(135deg,var(--brand-pink-400),var(--brand-pink-600))]";
// Inline, since the type-role lint reads any `text-[…]` as a font size.
export const PRO_INK = { color: "var(--brand-pink-600)" } as const;

/** Mesita Pro (MESITA-4385, cleaned in MESITA-4388, Pato: "chill out with
 *  your fucking shadows and ilumaination..its just a fucking subscription.
 *  make stuff cleaner"): the Me card's hairline border, no shadow; a pink
 *  band with the name and price; then two boxes (Pro's reservations per month,
 *  MCP connector Soon) and the action the guest's plan calls for
 *  (`children`). */
export function ProOffer({
  current,
  children,
}: {
  current: boolean;
  children?: React.ReactNode;
}) {
  const words = PLAN_ROWS.premium;
  return (
    <section
      aria-label={words.title}
      data-plan-row={words.title}
      className="border-border overflow-hidden rounded-2xl border"
    >
      <div
        className={cn(
          PRO_GRADIENT_CLASS,
          "flex items-center justify-between gap-3 px-4 py-3.5 text-white",
        )}
      >
        <h3 className="text-xl leading-tight font-bold">
          Mesita {words.title}
          {current && (
            <span
              data-plan-current=""
              className="type-meta ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 align-middle font-sans font-semibold"
            >
              Current
            </span>
          )}
        </h3>
        <p className="shrink-0 text-right">
          <span className="text-xl font-bold tabular-nums">
            {dollars(PRO_PRICE_CENTS)}
          </span>{" "}
          <span className="type-label text-white/85">USD a month</span>
        </p>
      </div>
      <div className="bg-card flex flex-col gap-3 p-4">
        {/* Two boxes, Pato's words (MESITA-4388: "just two boxes", Pro's
            reservations per month and "MCP connector. Soon."). */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted rounded-xl px-3 py-2.5">
            <p className="text-xl font-bold tabular-nums" style={PRO_INK}>
              {PRO_RESERVATIONS_PER_MONTH}
            </p>
            <p className="text-muted-foreground type-label">
              reservations per month
            </p>
          </div>
          <div className="bg-muted rounded-xl px-3 py-2.5">
            <p className="text-xl font-bold" style={PRO_INK}>
              MCP
            </p>
            <p className="text-muted-foreground type-label">
              connector ·{" "}
              <span className="text-foreground font-semibold">Soon</span>
            </p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

/** "Upgrade to Pro" with the true terms under it (MESITA-4359, 3A: Pro is
 *  monthly and Cancel Pro ends it at the period's end). */
export function UpgradeAction({
  onUpgrade,
  busy,
}: {
  onUpgrade: () => void;
  busy: boolean;
}) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <Button
        size="lg"
        className={cn(ME_BUTTON_CLASS, "w-full")}
        onClick={onUpgrade}
        disabled={busy}
        data-plan-upgrade=""
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Upgrade to Pro
      </Button>
      <p className="text-muted-foreground type-label text-center">
        Billed monthly in USD · Cancel anytime
      </p>
    </div>
  );
}
