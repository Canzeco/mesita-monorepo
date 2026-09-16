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
// ── IT FLIPS NOW (MESITA-1891) ────────────────────────────────────────────
//
// It was `aria-disabled` in every branch, even with Stripe Ready, because
// `place_profiles.mesita_pay_enabled` had no console writer and the line said
// the switch landed with the next release. It has one:
// `business-web-set-place-rails`, whose `mesita_pay` key is OWNER-ONLY
// (MESITA-1892 collapsed the organization's half of the bit into this column,
// and the EF kept the rank that collapse would otherwise have handed to every
// editor). So the OWNER's Ready branch is a real button and every other
// branch is exactly as locked as it was.
//
// ONE DOOR, ONE CALLER. The write goes through `setPlaceRails` in
// `place-manage/actions.ts` — the same server action the Capabilities ladder
// has used since MESITA-1736. A second action file pointed at the same
// endpoint is the "two callers for one door" the EF naming law exists to
// prevent, and it is the reason `actions/place-setup.ts` refuses to hold the
// member actions either.
//
// LOCAL STATE, AND A `key=` THAT BEATS IT. The switch answers the click
// immediately and reconciles from the EF's post-write row, so it needs its own
// `on`. That copy goes stale the moment the server re-renders with a newer
// value — so the page seeds this component with `key={...mesitaPayEnabled}`
// (products/pay/page.tsx) and React remounts it, which re-seeds `on` from
// truth. `router.refresh()` after a successful write is what makes that
// happen: the rail, the catalogue card and this page all read the same bit
// server-side, and without it they would disagree until the next navigation.
//
// A FLAT BRANCH CHAIN, in dependency order, each branch a track and one line
// (the MESITA-1864 idiom). Not partnered is first because it is upstream of
// everything — the page never renders this card in that state (it renders a
// LockedStrip), but a hand-migrated row with the column on and no
// subscription must still never show a live switch. Then the failed read,
// which is UNKNOWN and not "not ready" (MESITA-1861): the line says the read
// failed and asserts nothing about the account. Then the lock, whose line
// names the rung the account is on — never "connect Stripe first" to someone
// who did. Then the switch, live for an owner and `aria-disabled` for
// everyone else: an editor keeps the track they always had and the line that
// names who can move it, because the rank is the whole reason it will not
// move for them.
//
// `aria-describedby`, not text inside the label: `aria-label="Mesita Pay"`
// is the control's NAME and the source scans pin it; the sentence is its
// DESCRIPTION, so a reader hears the name, the state, and then why.

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNote } from "@/components/ErrorNote";
import {
  mesitaPayLockedLine,
  mesitaPaySwitchLine,
} from "@/components/console/badges";
import { setPlaceRails } from "@/components/place-manage/actions";
import { Track } from "@/components/place-manage/sections/controls/ladder-row";
import { railWriteFailure } from "@/components/place-manage/sections/controls/offerings";
import type { PaymentAccountState } from "@/lib/model/types";
import { cn } from "@/lib/utils";

const ROW_CLASS = "flex items-center gap-3 py-1";
const LINE_CLASS = "text-muted-foreground min-w-0 text-xs leading-snug";

/** One row shape for every branch: the track, then its sentence.
 *
 *  `onToggle` present ⇒ this caller may write, and the row IS the button —
 *  one interactive element, Space/Enter for free, a ~44px target. Absent ⇒
 *  the same markup as a static `aria-disabled` switch, which is what every
 *  locked branch and every insufficient rank renders. */
function SwitchRow({
  on,
  locked,
  line,
  busy = false,
  onToggle,
  error = null,
}: {
  on: boolean;
  locked: boolean;
  line: string;
  busy?: boolean;
  onToggle?: (next: boolean) => void;
  error?: string | null;
}) {
  const lineId = useId();
  const inner = (
    <>
      <Track on={on} busy={busy} locked={locked} />
      <span id={lineId} className={LINE_CLASS}>
        {line}
      </span>
    </>
  );
  return (
    <div className="flex flex-col">
      {onToggle ? (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Mesita Pay"
          aria-describedby={lineId}
          disabled={busy}
          onClick={() => onToggle(!on)}
          className={cn(
            ROW_CLASS,
            "w-full text-left transition",
            busy ? "cursor-default opacity-60" : "cursor-pointer hover:opacity-90",
          )}
        >
          {inner}
        </button>
      ) : (
        <div
          role="switch"
          aria-checked={on}
          aria-disabled="true"
          aria-label="Mesita Pay"
          aria-describedby={lineId}
          className={ROW_CLASS}
        >
          {inner}
        </div>
      )}
      {/* Always-mounted live region: one that mounts together with its
          message does not announce. */}
      <div aria-live="polite">{error && <ErrorNote message={error} />}</div>
    </div>
  );
}

export function MesitaPayCard({
  placeId,
  partnered,
  stripeReady,
  mesitaPayEnabled,
  isOwner,
  accountState,
  orphaned,
  loadError,
}: {
  placeId: string;
  partnered: boolean;
  stripeReady: boolean;
  mesitaPayEnabled: boolean;
  isOwner: boolean;
  accountState: PaymentAccountState;
  orphaned: boolean;
  loadError: string | null;
}) {
  const router = useRouter();
  // Seeded from the prop and re-seeded by the page's `key=` — see the
  // docblock. Hooks run before every branch below, because the branch chain
  // returns early and hooks may not.
  const [on, setOn] = useState(mesitaPayEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (next: boolean) => {
    if (busy) return;
    // Optimistic, then reconciled from the EF's post-write row — the same
    // shape `commitRail` uses on the Capabilities ladder.
    setOn(next);
    setError(null);
    setBusy(true);
    const r = await setPlaceRails(placeId, { mesita_pay: next });
    setBusy(false);
    if (!r.ok) {
      setOn(!next);
      // The raw Edge Function string never reaches the DOM: an operator
      // cannot act on a Postgres constraint name and an engineer can read
      // the console.
      console.error(`[mesita-pay] setPlaceRails mesita_pay=${next}:`, r.error);
      setError(railWriteFailure("Mesita Pay", next));
      return;
    }
    setOn(r.data.mesita_pay);
    router.refresh();
  };

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

  if (!isOwner) {
    return (
      <SwitchRow
        on={mesitaPayEnabled}
        locked={false}
        line={
          mesitaPayEnabled ? mesitaPaySwitchLine(true) : "An owner turns this on."
        }
      />
    );
  }

  return (
    <SwitchRow
      on={on}
      locked={false}
      busy={busy}
      error={error}
      line={mesitaPaySwitchLine(on)}
      onToggle={(next) => void toggle(next)}
    />
  );
}
