import { ChevronRight, Gift, ReceiptText, Ticket } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { HEADER_PILL } from "@/components/consumer/search/header-classes";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/shared/Skeleton";
import { PILL, WIDE } from "./header-pill";

// THE TICKETS SHORTCUT (Pato, 2026-11-14, MESITA-3891: "in wallet at the
// top up show a shortcut to transactions/tickets in me", then the same "top
// right" on Pay): the band's grey pill at the right of the "Wallet" title
// (MESITA-4245), opening Me › Tickets (every visit, voucher, gift and refund), pushed
// with Back. The band's own control shape
// (Search's Ask AI pill), so it reads as a control, not a fourth button next
// to Share and Gift. Reads nothing: the page and its loading frame draw it.
// 36px here, not the band pill's 40 (MESITA-4087: the shorter title band);
// Search keeps its 40px pill. INK since MESITA-4091 (Pato: "tickets button
// in pay and in wallet must be dark in order to make it visible"): the
// black of Continue, white words and icon. A BUTTON, NOT A PILL (MESITA-4107,
// Pato: "tickets must look like a button. maybe tickets>"): the app's button
// corners (rounded-xl, as Continue) and a › after the word. A MID GREY
// (MESITA-4331, Pato: "a bit dark but not that much"): ink at 15%, between
// the light bg-muted and the black of MESITA-4091. `tall` is the Wallet
// header's 40px pill, the card pill's twin: glyph and word, no › (MESITA-4497).
export function TicketsShortcut({
  tall = false,
  wide = false,
  icon = false,
}: { tall?: boolean; wide?: boolean; icon?: boolean } = {}) {
  // AN ICON, NO WORD (Pato, 2026-11-21, MESITA-4559: "it must not say
  // tickets, just a ticket icon with this > too"): the header's right-hand
  // button, a ticket glyph and a ›. WHITE, NOT BLACK (Pato, 2026-11-21,
  // MESITA-4580: "make button white, not black"): the page's cards' white
  // with their hairline and black ink; black since MESITA-4559. DARKER TO BE
  // SEEN (Pato, 2026-11-21, MESITA-4596: "tickets button at top right must be
  // darker to be visible"): MESITA-4331's mid grey, ink at 15%, black glyphs.
  // LIGHT AGAIN (Pato, 2026-11-21, MESITA-4612: "back to light"): ink at
  // 15%, black words and glyph; MESITA-4610's dark grey (ink at 80%, white)
  // lasted one deploy. LIGHTER (MESITA-4614, Pato: "make the tickets button
  // light"): bg-muted, the title strips' grey, black words and glyph.
  if (icon) {
    return (
      <PushLink
        href={CONSUMER_ROUTES.mePages.tickets}
        className="bg-muted text-foreground hover:bg-foreground/15 flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-base font-semibold"
        data-tickets-shortcut
      >
        {/* THE WORD, ANOTHER GLYPH, NO › (Pato, 2026-11-21, MESITA-4598: "in
            tickets actually mention Tickets, not only the icons … use a
            different icon because that looks like shit and remove the >"):
            a receipt and "Tickets". */}
        <ReceiptText className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        Tickets
      </PushLink>
    );
  }
  return (
    <PushLink
      href={CONSUMER_ROUTES.mePages.tickets}
      className={
        wide
          ? WIDE
          : tall
            ? PILL
            : cn(HEADER_PILL, "bg-foreground/15 text-foreground hover:bg-foreground/20 h-9 rounded-xl border-transparent pr-2 pl-3")
      }
      data-tickets-shortcut
    >
      <Ticket className={tall || wide ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} strokeWidth={2} aria-hidden />
      Tickets
      {tall || wide ? null : <ChevronRight className="-ml-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
    </PushLink>
  );
}

/** Tickets while the page reads (MESITA-4376): a bone in the pill's shape. */
export function TicketsShortcutSkeleton() {
  return <Skeleton className="h-9 w-28 rounded-xl" aria-hidden />;
}

/** SEND GIFT IN THE HEADER (Pato, 2026-11-23, MESITA-4780: "send gift is ...
 *  hiding that menu of two options, those two options must be super visible";
 *  /plan-design-review pick): the Wallet's black full-width bar became a grey
 *  "Gift" button beside Tickets, the same shape, opening Send Gift. */
export function GiftShortcut() {
  return (
    <PushLink
      href={CONSUMER_ROUTES.walletSend}
      className="bg-muted text-foreground hover:bg-foreground/15 flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-base font-semibold"
      data-send-gift
    >
      <Gift className="h-5 w-5 shrink-0 max-[359px]:hidden" strokeWidth={2} aria-hidden />
      Gift
    </PushLink>
  );
}
