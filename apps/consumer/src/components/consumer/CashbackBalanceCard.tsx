import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/api/tickets";

export function CashbackBalanceCard({
  cashbackBalanceCents,
}: {
  cashbackBalanceCents: number;
}) {
  return (
    <section className="border-border bg-pink-gradient shadow-glow rounded-2xl border p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-white/80 uppercase">
            Cashback balance
          </p>
          <p className="font-display mt-0.5 text-2xl font-semibold tabular-nums">
            {formatCurrency(cashbackBalanceCents)}
          </p>
        </div>
        <Wallet className="h-7 w-7 text-white/80" />
      </div>
      <p className="mt-3 text-[12px] leading-snug text-white/90">
        Auto-applies to your next bill at{" "}
        <span className="font-semibold">any Mesita partner</span>. No
        redeem button, no expiry while you stay active.
      </p>
    </section>
  );
}
