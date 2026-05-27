import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/tickets";
import { errMsg } from "@/lib/utils";
import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { CashbackBalanceCard } from "@/components/consumer/CashbackBalanceCard";

// /pay — the scan-at-the-bill surface. Single page: the consumer's QR
// code on top, the cashback balance card below. Split out of /coupons
// when the BottomNav grew to six tabs and the wallet's two jobs
// ("browse my deals" vs "scan me at the bill") earned their own homes.

export const dynamic = "force-dynamic";

export default async function PayPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/pay");

  let profile;
  try {
    profile = await apiFetchConsumerProfile(supabase);
  } catch (err) {
    return (
      <div className="flex h-full flex-col">
        <SimpleHeader title="Pay" />
        <div className="px-4 py-6">
          <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
            {errMsg(err, "Couldn't load your profile.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <SimpleHeader title="Pay" />
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
          <MyQrCard code={profile.code} />
          <CashbackBalanceCard
            cashbackBalanceCents={profile.cashback_balance_cents}
          />
        </div>
      </div>
    </div>
  );
}
