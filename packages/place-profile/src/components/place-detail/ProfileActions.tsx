"use client";

import {
  CalendarCheck,
  Heart,
  Map as MapIcon,
  Phone,
  QrCode,
  Rocket,
  Share2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type React from "react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { PLACE_PILL_CLASS } from "../../lib/ui";
import { buildDirectionsUrl } from "../../lib/maps-link";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";


// TWO ROWS OF TILES (Pato, MESITA-3315: "make those 3 buttons the same
// height of the other 5 buttons, but wider because are three instead of 5.
// and keep the dark colors"; MESITA-3314 had them as one row of 44px
// buttons, "the three buttons instead of lines buttons, in one line:
// Reserve, Prepay, Pay"; MESITA-2690 had three rows, Mesita Reserve full
// width over Mesita Prepay and Mesita Pay halved; MESITA-2688/2689 had
// Reserve and Pay side by side):
//
//   [ ♡ Save    ] [ ▣ Reserve ] [ ⇪ Share   ]
//   [ ▱ Maps    ] [ ✆ Contact ] [ ⇧ Upgrade ]   (MESITA-3425)
//   [ ▤ Prepay   (30% Bonus) ] [ ▦ Pay     (5% Back) ]   green, pinned (MESITA-3423)
//
// That is Pato's 3×3 sketch (MESITA-3419); layout D (MESITA-3416) before.
//
// ROW 1 is five equal grey tiles, icon over a 12px label. Save is the heart
// (MESITA-2521's favorite); once saved only the heart turns red, never the
// tile (MESITA-2635). Maps opens Google Maps already routing to the place
// (MESITA-2619); it read Directions until the fifth tile left no room for
// the word (MESITA-3200). Share is back here; the top bar's dots report.
// UPGRADE (Pato, MESITA-3200: "I don't like boost being hidden there below";
// MESITA-3201: "Upgrade just opens a modal on top, like contact") opens the
// host's sheet, never Checkout, on every place: a Google-only one gets that
// sheet's not-open-yet screen, so the row never changes width.
//
// ROW 2 is Reserve in the INK and the money tiles in LINK GREEN (Pato,
// MESITA-3353: "reserve with dark button"; "use the green color of Link to
// psychologically give trust: green background, black text"): green-400
// under near-black words, Stripe Link's pay button; all three emerald for
// an hour, MESITA-3348, and the ink from MESITA-3315 before that), the grey
// tiles' height (56px), the
// glyph at the left of a 12px label (MESITA-3335; it sat over the label
// until then), 8px apart (Pato, MESITA-2689: "same height and
// colour"), three equal widths, the labels without "Mesita ". PREPAY AND
// PAY SAY THE AMOUNT under the label, always, blocked or not (Pato,
// MESITA-3324: "Prepay, Up to 25% OFF / Pay, 5% Cashback ... BUT ALWAYS
// MENTION THE AMOUNT"): his fixed sentences (MESITA-3313; cashback is the
// standard 5%, MESITA-3299), never a number computed here. No chip
// on any of them (MESITA-3317, Pato: "remove the stupid walk-in icon. just
// put the button blocked if it doesn't work"): a blocked tile is the same
// dark tile, disabled, and only the screen reader hears why. NO TIMES ON
// THE PROFILE
// (Pato, MESITA-2633: fixed hours "can be confused with confirmed
// availability"): the guest picks day, party and a preferred time in the
// sheet, then the agent calls and confirms. Pay waits for W2b (MESITA-3305)
// and Prepay for its own wave: since W1b (MESITA-3303) buying a voucher
// lives on the Vouchers tab, and W1b had taken the Prepay button off, but
// Pato's row names it (MESITA-3314), so it stays. Both are inert and wear
// NO Soon chip (Pato, MESITA-3315: "remove the soon btw"; the consumer
// bar's grey Soon tag sat on them from MESITA-2690). MESITA-2618 had taken
// Pay off.
//
// No "I went" (MESITA-2567), no pinned bar. Every button is 44px or more
// (MESITA-2324). A missing callback leaves its button visible and inert, so
// admin's preview keeps the consumer's shape. A PLACE THAT TAKES NO
// RESERVATIONS HAS A DISABLED RESERVE, NEVER A MISSING ONE (Pato, MESITA-3078:
// "must be disabled, but never fucking disapearing"; MESITA-3076 had hidden
// it). BLOCKED IS DARK (Pato, MESITA-3081: "reservations must be blocked
// dark", "same for mesita prepay and mesita pay"): every blocked Mesita
// button is the ink button, `disabled`, no hover, no press. Reserve varies by
// place ("reserve can vary depending on the place"): live where it takes
// bookings, blocked where it doesn't (its Walk-in chip left with
// MESITA-3317). Prepay and Pay are both blocked, with no chip: the free-amount prepay left with the discount
// product (MESITA-3299), vouchers sell on their tab (MESITA-3303) and paying
// arrives with W2b (MESITA-3305).

// THE TILES ARE ONE STEP DARKER THAN --fill (Pato, MESITA-2647: "make the
// four gray buttons a bit darker, just a bit, minimum"): the border grey at
// 60% over the white band ≈ #e9e9e9 (bg-muted is #efefef); hover 80%.
// THE ROWS' LAYOUT AND A TILE'S BOX ARE WRITTEN ONCE (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"): read here and by ProfileSummarySkeleton, which lays its bones
// out in them. The ink row is the tiles' 56px.

/** The tiles row's wrapper in the band (the Mesita row rides in the sticky
 *  block since MESITA-3330; ONE GAP EVERY WAY, Pato, MESITA-2823). */
export const PROFILE_ACTIONS_CLASS = "flex flex-col gap-2";
/** Rows 1–2: six grey tiles, three a row, 8px apart (Pato, MESITA-3419: his
 *  3×3 sketch, "try this grid instead"). Five in one row until then. */
export const PROFILE_TILES_ROW_CLASS = "grid grid-cols-3 gap-2";
/** A tile's box: 40px (Pato, MESITA-3423: "even shorter, just a bit"; 44px, rounded-lg, the glyph beside the label (Pato,
 *  MESITA-3421: "the icons must be horizontal now ... and make the buttons
 *  shorter"), the tap floor of MESITA-2324, from MESITA-3421 until then;
 *  56px with the glyph over the label before that). */
export const PROFILE_TILE_BOX_CLASS =
  "flex h-10 min-w-0 flex-row items-center justify-center gap-1.5 rounded-lg px-1.5";
/** Row 3, pinned: Prepay · Pay, half each (MESITA-3423; Prepay · Card · Pay
 *  from MESITA-3419). */
export const PROFILE_MESITA_ROW_CLASS = "grid grid-cols-2 gap-2";

/** A Mesita tile's box: the grey tile's own (MESITA-3419, MESITA-3421). */
export const PROFILE_MESITA_TILE_BOX_CLASS = PROFILE_TILE_BOX_CLASS;

// Prepay and Pay are Link green; the ink tone was Card's (MESITA-3419) until
// Card left (MESITA-3423).
const MONEY_TONE = {
  green: "bg-green-400 text-neutral-950",
  ink: "bg-foreground text-paper",
} as const;

const tileBtn = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-border/60 text-foreground hover:bg-border/80 text-xs font-semibold transition active:scale-[0.99]",
);

function ActionTile({
  Icon,
  label,
  live,
  onClick,
  pressed,
  ariaLabel,
  dialog = false,
  className,
  iconClassName,
  dataDirectionsUrl,
  disabled = false,
  children,
}: {
  Icon?: LucideIcon;
  label: string;
  live: boolean;
  onClick?: () => void;
  pressed?: boolean;
  ariaLabel?: string;
  dialog?: boolean;
  className?: string;
  iconClassName?: string;
  /** The Directions tile carries its Google Maps link for inspection. */
  dataDirectionsUrl?: string;
  /** A blocked tile (Reserve where the place takes no bookings): drawn,
   *  never hidden (MESITA-3078), `disabled`, faded, no hover. */
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...(live && onClick
        ? {
            onClick,
            ...(pressed !== undefined ? { "aria-pressed": pressed } : {}),
            ...(dialog ? { "aria-haspopup": "dialog" as const } : {}),
          }
        : inertButtonProps(false))}
      aria-label={ariaLabel}
      data-directions-url={dataDirectionsUrl}
      disabled={disabled}
      // NEVER LOOKS BLOCKED (Pato, MESITA-3423: "don't make the reserve button
      // look blocked. make it gray too"): a tile with nothing behind it is the
      // same grey tile; only the screen reader hears why (aria-label).
      className={cn(tileBtn, disabled && "hover:bg-border/60 active:scale-100", className)}
    >
      {children ??
        (Icon ? (
          <Icon
            className={cn("h-[18px] w-[18px] shrink-0", iconClassName)}
            strokeWidth={2.25}
          />
        ) : null)}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function ProfileActions({
  place,
  actions,
  className,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  className?: string;
}) {
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = actions?.saved === true;
  const onSave = actions?.onSave;
  const onContact = actions?.onContact;
  const onShare = actions?.onShare;
  const onOpenLink = actions?.onOpenLink;
  const onReserve = actions?.onReserve;
  const onBoost = actions?.onBoost;
  const takesReservations = isReserveActionEnabled(place);
  const directionsUrl = buildDirectionsUrl(place);

  return (
    <div className={cn(PROFILE_ACTIONS_CLASS, className)}>
      <div className={PROFILE_TILES_ROW_CLASS} data-profile-actions="tiles">
        <ActionTile
          Icon={Heart}
          // SAVE, NOT LIKE (Pato, MESITA-2668: "use word save instead of
          // liked but keep the heart"), as on the Home tile and the Search
          // card.
          label={saved ? "Saved" : "Save"}
          live={Boolean(onSave)}
          onClick={onSave}
          pressed={saved}
          ariaLabel={saved ? "Remove from favorites" : "Add to favorites"}
          // LIKED IS A RED HEART, NOT A RED TILE (Pato, MESITA-2635: "that
          // red is just too red"): the tile stays grey like its neighbours
          // and only the glyph fills, the way Instagram marks a like.
          iconClassName={cn(saved && "fill-destructive text-destructive")}
        />
        {/* THE GREY GRID (Pato, MESITA-3425: "save reserve share / maps contact
            upgrade"; Save · Maps · Share first in MESITA-3419): Save · Reserve · Share
            over Reserve · Contact · Upgrade. Reserve joined the grey tiles in
            MESITA-3416; a place that takes no bookings keeps it, blocked
            (MESITA-3078: "never fucking disapearing"). */}
        <ActionTile
          Icon={CalendarCheck}
          label="Reserve"
          live={takesReservations && Boolean(onReserve)}
          onClick={onReserve}
          disabled={!takesReservations}
          dialog
          ariaLabel={takesReservations ? "Reserve a table" : "Reserve a table, not available at this place"}
        />
        <ActionTile
          Icon={Share2}
          label="Share"
          live={Boolean(onShare)}
          onClick={onShare}
          ariaLabel="Share"
        />
        <ActionTile
          // The folded map again (Pato, MESITA-2669: "MAYBE for directions do
          // use a map"), first worn in MESITA-2649. The car (MESITA-2640,
          // MESITA-2668), Signpost (MESITA-2638), Route (MESITA-2635) and the
          // paper plane each lived a night. Imported as MapIcon so it never
          // shadows the global Map.
          Icon={MapIcon}
          label="Maps"
          live={Boolean(onOpenLink)}
          onClick={onOpenLink ? () => onOpenLink(directionsUrl) : undefined}
          ariaLabel="Directions in Google Maps"
          dataDirectionsUrl={directionsUrl}
        />
        <ActionTile
          label="Contact"
          live={Boolean(onContact)}
          onClick={onContact}
          ariaLabel="Contact"
          dialog
        >
          {hasWhatsApp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/channels/whatsapp.svg"
              alt=""
              aria-hidden
              className="h-[18px] w-[18px] shrink-0"
            />
          ) : (
            <Phone className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
          )}
        </ActionTile>
        <ActionTile
          Icon={Rocket}
          label="Upgrade"
          live={Boolean(onBoost)}
          onClick={onBoost}
          ariaLabel="Upgrade this place"
        />
      </div>
    </div>
  );
}

/** THE MESITA ROW, PINNED (Pato, MESITA-3330: "the dark buttons must not be
 *  scrollable, those stuck at the top"): Reserve · Prepay · Pay leave the
 *  summary band and ride in PlaceDetailBody's sticky block with the tab
 *  strip, so they stay reachable while the body scrolls; the grey tiles
 *  scroll away with the summary. Same tiles, same wiring. */
export function MesitaActions({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  // PREPAY AND PAY OPEN REWARDS (Pato, MESITA-3412: "Rewards modal opens when
  // you click either prepay or pay, but covering almost full screen"): the
  // Rewards tab left the strip and became the host's sheet. Prepay lands on
  // Pre-Payment Rewards, Pay on Payment Rewards. With no host callback
  // (admin's Preview) both stay the inert green tile. Always drawn: the tab
  // that hid them (MESITA-3398) is gone.
  const onOpenRewards = actions?.onOpenRewards;
  const open = (section: "payment" | "prepayment") =>
    onOpenRewards ? () => onOpenRewards(section) : undefined;
  return (
    <div className={PROFILE_MESITA_ROW_CLASS} data-profile-actions="mesita">
      <MoneyTile Icon={Wallet} label="Prepay" amount="30% Bonus" badge="30% Bonus" tone="green" onClick={open("prepayment")} />
      {/* CARD LEFT (Pato, MESITA-3423: "remove card from there ... last row is
          only two columns: prepay and pay"); the credit is in the Rewards sheet. */}
      <MoneyTile Icon={QrCode} label="Pay" amount="5% Back" badge="5% Back" tone="green" onClick={open("payment")} />
    </div>
  );
}

/** The sticky block the Mesita row and the tab strip share: white, full
 *  width (the body's 16px sides undone), above the boxes (MESITA-3330).
 *  mb-1: 12 (the column's gap-3) + 4 = 16px under the strip's hairline on
 *  every tab at rest, the same as the 16px sides (MESITA-3379; Overview had
 *  12, Rewards 16, Reviews 32). The margin is not painted: pinned, content
 *  meets the hairline as under any sticky header. */
export const PLACE_STICKY_BLOCK_CLASS = "bg-card sticky top-0 z-20 -mx-4 mb-1 flex flex-col";
/** The Mesita row inside it: 16px sides, 16px under, a hairline, then the
 *  strip (8px over for the corner badges from MESITA-3421 to MESITA-3424). */
export const PLACE_STICKY_ROW_CLASS = "border-border border-b px-4 pb-4";

/** A Mesita tile's glyph: the grey tiles' 18px. */
const MESITA_TILE_ICON = "h-[18px] w-[18px] shrink-0";

/** A Mesita money tile that is not built yet: the blocked ink tile, no chip
 *  (Pato, MESITA-3315: "remove the soon"); the screen reader still hears it.
 *  `amount` is the second line, always shown (MESITA-3324): "30% Bonus" (Pato,
 *  MESITA-3349: "don't mention up to 30% bonus, just 30% Bonus"; "Up to"
 *  for an hour, MESITA-3345) and
 *  "5% Back" (Pato, MESITA-3339: "its clearer, instead of OFF"; "Up to 25%
 *  OFF" and "5% Cashback" until then). */
function MoneyTile({
  Icon,
  label,
  amount,
  tone,
  badge,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  /** What the screen reader hears after the label ("30% Bonus"). */
  amount: string;
  tone: keyof typeof MONEY_TONE;
  /** The ink pill beside the label ("30% Bonus"). */
  badge?: string;
  /** Opens the host's Rewards sheet; absent, the tile is inert. */
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      {...(onClick ? { onClick, "aria-haspopup": "dialog" as const } : inertButtonProps(false))}
      disabled={!onClick}
      aria-label={onClick ? `${label}, ${amount}` : `${label}, ${amount}, not available here`}
      className={cn(
        PROFILE_MESITA_TILE_BOX_CLASS,
        MONEY_TONE[tone],
        "text-xs font-semibold",
        onClick ? "transition hover:opacity-90 active:scale-[0.99]" : "cursor-not-allowed",
      )}
    >
      {/* Glyph beside label, the grey tiles' shape (MESITA-3421). THE BONUS
          ON THE CORNER (Pato, MESITA-3421: "in prepay and pay mention the
          fucking bonus"): a third of the row holds glyph and "Prepay" but not
          "30% Bonus" beside them, so the ink pill rode the top-right corner; INSIDE
          THE GREEN (Pato, MESITA-3424: "bonus and back must go inside the green
          boxes"): with two halves, glyph · label · pill fit one line. */}
      <Icon className={MESITA_TILE_ICON} strokeWidth={2.25} />
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      {badge ? (
        <span className={cn(PLACE_PILL_CLASS, "bg-foreground text-paper shrink-0")} aria-hidden>
          {badge}
        </span>
      ) : null}
    </button>
  );
}
