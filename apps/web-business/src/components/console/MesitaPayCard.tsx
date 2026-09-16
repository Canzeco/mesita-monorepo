"use client";

// Mesita Pay's switch, on the product's own setup page (MESITA-1867).
//
// This is the switch that used to be PartnerCard. MESITA-1798 drew it as a
// `role="switch"` row in the Capabilities-ladder grammar with Stripe Ready
// as the lock; MESITA-1864 made the locked state a dimmed track and one line
// instead of a pill, so every branch renders the same control; MESITA-1866
// put it under the Stripe account with a seam, because the account and the
// switch it unlocks are one subject. All of that holds — it just stopped
// being the Partner switch. Partner is a yearly subscription now
// (PartnerCard.tsx); THIS is the optional add-on on top of it: card payments
// inside Mesita, through the place's own Stripe account, and it is the thing
// Stripe Ready actually gates.
//
// IT IS `aria-disabled`, EVEN WHEN STRIPE IS READY. The column it mirrors,
// `place_profiles.mesita_pay_enabled`, has exactly one writer and it is not a
// console door: `_shared/place-rails.ts` (MESITA-1892 folded the organization
// half of the bit into it, so there is one switch again where there were two).
// MESITA-1868 adds the owner-only writer gated on partnered ∧ Stripe Ready;
// until then the track shows the flag honestly and the sentence says the
// switch lands with the next release. No `useState`, no `key=` remount:
// nothing here writes, so nothing needs re-seeding.
//
// A FLAT BRANCH CHAIN, in dependency order, each branch a track and one line
// (the MESITA-1864 idiom). Not partnered is first because it is upstream of
// everything — the page never renders this card in that state (it renders a
// LockedStrip), but a hand-migrated row with the column on and no
// subscription must still never show a live switch. Then the failed read,
// which is UNKNOWN and not "not ready" (MESITA-1861): the line says the read
// failed and asserts nothing about the account. Then the lock, whose line
// names the rung the account is on — never "connect Stripe first" to someone
// who did. Then the switch.
//
// `aria-describedby`, not text inside the label: `aria-label="Mesita Pay"`
// is the control's NAME and the source scans pin it; the sentence is its
// DESCRIPTION, so a reader hears the name, the state, and then why.

import { useId } from "react";
import {
  mesitaPayLockedLine,
  mesitaPaySwitchLine,
} from "@/components/console/badges";
import { Track } from "@/components/place-manage/sections/controls/ladder-row";
import type { PaymentAccountState } from "@/lib/model/types";

const ROW_CLASS = "flex items-center gap-3 py-1";
const LINE_CLASS = "text-muted-foreground min-w-0 text-xs leading-snug";

/** One row shape for every branch: the track, then its sentence. */
function SwitchRow({
  on,
  locked,
  line,
}: {
  on: boolean;
  locked: boolean;
  line: string;
}) {
  const lineId = useId();
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-disabled="true"
      aria-label="Mesita Pay"
      aria-describedby={lineId}
      className={ROW_CLASS}
    >
      <Track on={on} busy={false} locked={locked} />
      <span id={lineId} className={LINE_CLASS}>
        {line}
      </span>
    </div>
  );
}

export function MesitaPayCard({
  partnered,
  stripeReady,
  mesitaPayEnabled,
  isOwner,
  accountState,
  orphaned,
  loadError,
}: {
  partnered: boolean;
  stripeReady: boolean;
  mesitaPayEnabled: boolean;
  isOwner: boolean;
  accountState: PaymentAccountState;
  orphaned: boolean;
  loadError: string | null;
}) {
  if (!partnered) {
    return <SwitchRow on={false} locked line="Needs Mesita Partner first." />;
  }

  if (loadError) {
    return (
      <SwitchRow on={false} locked line="Couldn't read the Stripe account." />
    );
  }

  if (!stripeReady) {
    return (
      <SwitchRow
        on={false}
        locked
        line={mesitaPayLockedLine(accountState, orphaned)}
      />
    );
  }

  return (
    <SwitchRow
      on={mesitaPayEnabled}
      locked={false}
      line={
        isOwner
          ? mesitaPaySwitchLine(mesitaPayEnabled) + " Switch lands with the next release."
          : mesitaPayEnabled
            ? mesitaPaySwitchLine(true)
            : "An owner turns this on."
      }
    />
  );
}
