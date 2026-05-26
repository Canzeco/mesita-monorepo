import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/tickets";
import { errMsg } from "@/lib/utils";
import { CashbackBalanceCard } from "@/components/consumer/CashbackBalanceCard";
import { WalletActivity } from "./WalletActivity";

export const dynamic = "force-dynamic";

export default async function PayWalletPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/pay/wallet");

  let profile;
  try {
    profile = await apiFetchConsumerProfile(supabase);
  } catch (err) {
    return (
      <div className="px-4 py-6">
        <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
          {errMsg(err, "Couldn't load your wallet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
      <CashbackBalanceCard
        cashbackBalanceCents={profile.cashback_balance_cents}
      />
      <WalletActivity />
    </div>
  );
}
