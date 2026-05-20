import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet as WalletIcon,
  CreditCard,
  Download,
  Calendar,
  Percent,
} from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { WALLET, TRANSACTIONS } from "@/lib/manager-data";
import { cn } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/manager/sign-in?next=/manager/wallet");

  return (
    <>
      <Topbar
        title="Wallet"
        subtitle="What Mesita owes you · payouts and ledger"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
          <div className="border-secondary/40 bg-secondary/5 text-secondary rounded-2xl border border-dashed px-4 py-3 text-[12px]">
            Preview — wallet numbers below are illustrative. Real payouts +
            ledger ship once Stripe Connect is wired up.
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="bg-peacock shadow-glow overflow-hidden rounded-2xl p-6 text-white lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.18em] uppercase opacity-80">
                    We owe you
                  </p>
                  <p className="font-display mt-2 text-5xl leading-none font-bold tracking-tight">
                    MX${WALLET.balance.toLocaleString()}
                  </p>
                  <p className="mt-2 text-[12px] opacity-85">
                    MX${WALLET.thisMonth.toLocaleString()} this month · MX$
                    {WALLET.lifetime.toLocaleString()} lifetime · net of
                    cashback &amp; fees
                  </p>
                </div>
                <WalletIcon className="h-10 w-10 opacity-30" />
              </div>
              <div className="mt-5 flex gap-2">
                <button className="text-foreground inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold">
                  <ArrowDownRight className="h-4 w-4" />
                  Withdraw to bank
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13px] font-semibold">
                  <Download className="h-4 w-4" />
                  Export ledger
                </button>
              </div>
            </div>

            <div className="border-border bg-card rounded-2xl border p-5">
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                Payout account
              </p>
              <div className="mt-2 flex items-center gap-2">
                <CreditCard className="text-secondary h-5 w-5" />
                <p className="font-display text-lg font-semibold tracking-tight">
                  {WALLET.payoutAccount}
                </p>
              </div>
              <p className="text-muted-foreground mt-1 text-[12px]">
                Auto-payout every Monday · powered by Stripe
              </p>
              <div className="border-border bg-background mt-4 rounded-xl border p-3 text-sm">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                  Next payout
                </p>
                <p className="mt-1 font-medium">
                  Monday · MX${WALLET.balance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="border-border bg-card rounded-2xl border p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                Ledger
              </p>
              <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
                <Calendar className="h-3.5 w-3.5" />
                Last 30 days
              </div>
            </div>
            <table className="mt-3 w-full">
              <thead>
                <tr className="text-muted-foreground text-left text-[10px] tracking-wider uppercase">
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium">Balance effect</th>
                  <th className="py-2 font-medium">Cashback</th>
                  <th className="py-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {TRANSACTIONS.map((t) => (
                  <tr key={t.id} className="border-border border-t text-sm">
                    <td className="py-2.5">
                      <TypeBadge kind={t.kind} />
                    </td>
                    <td className="py-2.5">{t.label}</td>
                    <td
                      className={cn(
                        "py-2.5 tabular-nums",
                        t.amount > 0
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t.amount > 0 ? "+" : "−"}MX$
                      {Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td className="text-secondary py-2.5 tabular-nums">
                      {t.cashback === 0
                        ? "—"
                        : `${t.cashback > 0 ? "+" : "−"}MX$${Math.abs(t.cashback).toLocaleString()}`}
                    </td>
                    <td className="text-muted-foreground py-2.5 text-right">
                      {t.when}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function TypeBadge({ kind }: { kind: "visit" | "payout" | "fee" }) {
  const meta = {
    visit: {
      Icon: ArrowUpRight,
      label: "Visit",
      tone: "bg-secondary/15 text-secondary",
    },
    payout: {
      Icon: ArrowDownRight,
      label: "Payout",
      tone: "bg-tier-gold/30 text-foreground",
    },
    fee: {
      Icon: Percent,
      label: "Fee",
      tone: "bg-muted text-muted-foreground",
    },
  }[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${meta.tone}`}
    >
      <meta.Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
