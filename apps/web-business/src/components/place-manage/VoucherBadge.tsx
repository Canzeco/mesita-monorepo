// A voucher's mark on a Business list (MESITA-4554, Pato: "voucher icon, like
// the story or the welcome … more graphical"): the same icon and colour as
// the voucher's row on Offers (PaymentsPanel), so one voucher reads the same
// everywhere: Welcome blue confetti, Story pink Instagram, the sizes green
// ticket, VIP black crown.
import type { Icon } from "@phosphor-icons/react";
import { ConfettiIcon, CreditCardIcon, CrownSimpleIcon, FootprintsIcon, GiftIcon, InstagramLogoIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { voucherName } from "@/lib/ticket-desk";
import { cn } from "@/lib/utils";

const MARK: Record<string, { icon: Icon; tone: string }> = {
  voucher_200: { icon: TicketIcon, tone: "bg-green-100 text-green-700" },
  voucher_1000: { icon: TicketIcon, tone: "bg-green-100 text-green-700" },
  voucher_5000: { icon: TicketIcon, tone: "bg-green-100 text-green-700" },
  voucher_welcome: { icon: ConfettiIcon, tone: "bg-blue-100 text-blue-700" },
  voucher_story: { icon: InstagramLogoIcon, tone: "bg-pink-100 text-pink-700" },
  voucher_vip: { icon: CrownSimpleIcon, tone: "bg-foreground text-background" },
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
