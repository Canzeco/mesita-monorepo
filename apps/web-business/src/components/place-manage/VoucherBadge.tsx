// A voucher's mark on a Business list (MESITA-4554, Pato: "voucher icon, like
// the story or the welcome … more graphical"): the same icon and colour as
// the voucher's row on Offers (PaymentsPanel), so one voucher reads the same
// everywhere: Welcome blue confetti, Story pink Instagram, the sizes green
// ticket, VIP black crown.
import type { Icon } from "@phosphor-icons/react";
import { ConfettiIcon, CrownSimpleIcon, InstagramLogoIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
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
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full pr-2.5 pl-1.5 text-xs font-semibold whitespace-nowrap", mark.tone)}>
      <Mark size={14} weight="fill" aria-hidden />
      {voucherName(code)}
    </span>
  );
}
