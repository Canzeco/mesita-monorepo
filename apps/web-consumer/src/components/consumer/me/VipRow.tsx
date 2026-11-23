import { ChevronRight, Gem } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import type { ConsumerProfile } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { isVip, vipTitle } from "@/lib/vip";

// ME'S VIP ROW (Pato, 2026-11-23, MESITA-4766: "BRING BACK VIP CUSTOMERS").
// A VIP reads one row at the top of Me: a black gem, how they got in, what
// it does. Anyone else reads a quiet "Have an invitation code?" that opens
// /me/vip. The server's Class decides which; the word "Regular" never shows.
export function VipRow({ profile }: { profile: Pick<ConsumerProfile, "guest_class" | "vip_reason"> }) {
  const href = CONSUMER_ROUTES.mePages.vip;
  if (isVip(profile)) {
    return (
      <PushLink
        href={href}
        className="border-border bg-card shadow-rest hover:bg-muted/40 flex w-full items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.98]"
        data-me-vip
      >
        <span className="bg-foreground text-background flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden>
          <Gem className="h-[19px] w-[19px]" strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold tracking-tight">{vipTitle(profile.vip_reason ?? null)}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">Higher Back on return visits at places that offer it</span>
        </span>
      </PushLink>
    );
  }
  return (
    <PushLink
      href={href}
      className="text-muted-foreground hover:text-foreground flex min-h-11 w-full items-center justify-between gap-2 px-1 text-sm font-semibold transition"
      data-me-vip-code
    >
      Have an invitation code?
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
    </PushLink>
  );
}
