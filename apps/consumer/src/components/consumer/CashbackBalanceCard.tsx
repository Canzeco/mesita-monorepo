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
      <p className="mt-3 text-[11px] leading-snug text-white/85">
        Auto-applies to your next bill at{" "}
        <span className="font-semibold">any partner</span> — Formal or Informal.
        At Informal venues it comes off the discounted total: e.g. MX$500
        bill with 10% off and MX$200 balance → you hand the waiter MX$250
        in cash and Mesita pays them the MX$200 from your wallet. No redeem
        button, no expiry while you stay active.
      </p>
    </section>
  );
}
