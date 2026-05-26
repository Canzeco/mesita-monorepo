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
import { Topbar } from "@/components/business/Topbar";
import { Section } from "@/components/shared";
import { WALLET, TRANSACTIONS } from "@/lib/business-data";
import { cn } from "@/lib/utils";
import { NUMBER_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/wallet`);

  return (
    <>
      <Topbar
        title="Wallet"
        subtitle="What Mesita owes you · payouts and ledger"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <p className="border-secondary/40 bg-secondary/5 text-secondary rounded-2xl border border-dashed px-4 py-3 text-[12px]">
            Preview — wallet numbers below are illustrative. Real payouts +
            ledger ship once Stripe Connect is wired up.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Hero balance card — branded peacock fill, intentionally
                off-pattern from Section so it visually leads the page. */}
            <div className="bg-peacock shadow-glow overflow-hidden rounded-2xl p-6 text-white lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase opacity-80">
                    We owe you
                  </p>
                  <p
                    className={cn(NUMBER_CLASS, "mt-2 text-5xl tracking-tight")}
                  >
                    MX${WALLET.balance.toLocaleString()}
                  </p>
                  <p className="mt-2 text-[12px] leading-snug opacity-85">
                    MX${WALLET.thisMonth.toLocaleString()} this month · MX$
                    {WALLET.lifetime.toLocaleString()} lifetime · net of
                    cashback &amp; fees
                  </p>
                </div>
                <WalletIcon className="h-10 w-10 opacity-30" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="text-foreground inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold transition hover:opacity-90">
                  <ArrowDownRight className="h-4 w-4" />
                  Withdraw to bank
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13px] font-semibold transition hover:bg-white/20">
                  <Download className="h-4 w-4" />
                  Export ledger
                </button>
              </div>
            </div>

            <Section title="Payout account">
              <div className="flex items-center gap-2">
                <CreditCard className="text-secondary h-5 w-5" />
                <p className="font-display text-lg font-semibold tracking-tight">
                  {WALLET.payoutAccount}
                </p>
              </div>
              <p className="text-muted-foreground text-[12px]">
                Auto-payout every Monday · powered by Stripe
              </p>
              <div className="border-border bg-background rounded-xl border p-3">
                <p className={TINY_LABEL_CLASS}>Next payout</p>
                <p className="mt-1 text-sm font-medium">
                  Monday · MX${WALLET.balance.toLocaleString()}
                </p>
              </div>
            </Section>
          </div>

          <Section
            title="Ledger"
            right={
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[12px]">
                <Calendar className="h-3.5 w-3.5" />
                Last 30 days
              </span>
            }
          >
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className={cn(TINY_LABEL_CLASS, "text-left")}>
                    <th className="py-2 font-semibold">Type</th>
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 font-semibold">Balance</th>
                    <th className="py-2 font-semibold">Cashback</th>
                    <th className="py-2 text-right font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSACTIONS.map((t) => (
                    <tr
                      key={t.id}
                      className="border-border/60 border-t text-sm"
                    >
                      <td className="py-2.5">
                        <TypeBadge kind={t.kind} />
                      </td>
                      <td className="py-2.5">{t.label}</td>
                      <td
                        className={cn(
                          "py-2.5 tabular-nums",
                          t.amount > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {signedMx(t.amount)}
                      </td>
                      <td className="text-secondary py-2.5 tabular-nums">
                        {t.cashback === 0 ? "—" : signedMx(t.cashback)}
                      </td>
                      <td className="text-muted-foreground py-2.5 text-right">
                        {t.when}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        meta.tone,
      )}
    >
      <meta.Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// Mock ledger uses raw MX$ amounts — keep the sign-aware formatter local
// to wallet for now. When the real Stripe payout EF lands the cents
// numbers will route through formatCurrency() instead.
function signedMx(n: number): string {
  return `${n >= 0 ? "+" : "−"}MX$${Math.abs(n).toLocaleString()}`;
}
