// A voucher's mark on a Business list (MESITA-4554, Pato: "more
// graphical"): the same icon and colour as the voucher's row on Offers
// (PaymentsPanel), so one voucher reads the same everywhere: the sizes green
// ticket, Welcome green confetti (MESITA-4645), VIP black crown. Any other code (an old Story purchase,
// MESITA-4641) wears the green ticket with its name.
import type { Icon } from "@phosphor-icons/react";
import { CoinsIcon, ConfettiIcon, CreditCardIcon, MoneyIcon, CrownSimpleIcon, FootprintsIcon, GiftIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { voucherName } from "@/lib/ticket-desk";
import { cn } from "@/lib/utils";

const MARK: Record<string, { icon: Icon; tone: string }> = {
  voucher_200: { icon: TicketIcon, tone: "bg-green-100 text-green-700" },
  voucher_1000: { icon: TicketIcon, tone: "bg-green-100 text-green-700" },
  voucher_5000: { icon: TicketIcon, tone: "bg-green-100 text-green-700" },
  voucher_welcome: { icon: ConfettiIcon, tone: "bg-green-100 text-green-700" },
  // Yellow (MESITA-4688), as on the guest's Offers page.
  voucher_vip: { icon: CrownSimpleIcon, tone: "bg-yellow-100 text-yellow-800" },
};

export function VoucherBadge({ code }: { code: string | null }) {
  const mark = MARK[code ?? ""] ?? { icon: TicketIcon, tone: "bg-green-100 text-green-700" };
  const Mark = mark.icon;
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full pr-2 pl-1.5 text-xs font-semibold whitespace-nowrap", mark.tone)}>
      <Mark size={12} weight="fill" aria-hidden />
      {voucherName(code)}
    </span>
  );
}

const PILL = "inline-flex h-5 items-center gap-1 rounded-full pr-2 pl-1.5 text-xs font-semibold whitespace-nowrap";

/** A credit row's mark (MESITA-4554): its voucher's badge, or Gift, or Visit. */
export function CreditBadge({ kind, voucher }: { kind: string; voucher: string | null }) {
  if (voucher) return <VoucherBadge code={voucher} />;
  if (kind.startsWith("gift")) {
    return (
      <span className={cn(PILL, "bg-amber-100 text-amber-800")}>
        <GiftIcon size={12} weight="fill" aria-hidden />
        Gift
      </span>
    );
  }
  if (kind === "credit") {
    return (
      <span className={cn(PILL, "bg-muted text-foreground")}>
        <CoinsIcon size={12} weight="fill" aria-hidden />
        Credit
      </span>
    );
  }
  if (kind === "spend" || kind === "refund") {
    return (
      <span className={cn(PILL, "bg-muted text-foreground")}>
        <FootprintsIcon size={12} weight="fill" aria-hidden />
        Visit
      </span>
    );
  }
  return null;
}

/** A visit's mark: the footprints, with its status word (Open, Paid…). */
export function VisitBadge({ status }: { status: string }) {
  return (
    <span className={cn(PILL, "bg-orange-100 text-orange-800")}>
      <FootprintsIcon size={12} weight="fill" aria-hidden />
      {status}
    </span>
  );
}

/** A Stripe card payment's mark, in Stripe's purple. */
export function CardBadge({ status }: { status: string | null }) {
  return (
    <span className={PILL} style={{ color: "#635BFF", backgroundColor: "rgb(99 91 255 / 0.1)" }}>
      <CreditCardIcon size={12} weight="fill" aria-hidden />
      {status ?? "Card"}
    </span>
  );
}

/** Cash: the part paid outside Mesita, at the table (MESITA-4567). */
export function CashBadge() {
  return (
    <span className={cn(PILL, "bg-green-100 text-green-800")}>
      <MoneyIcon size={12} weight="fill" aria-hidden />
      Cash
    </span>
  );
}
