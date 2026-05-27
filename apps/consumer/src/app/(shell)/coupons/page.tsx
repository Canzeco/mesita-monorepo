import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/tickets";
import { errMsg } from "@/lib/utils";
import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { CashbackBalanceCard } from "@/components/consumer/CashbackBalanceCard";
import { CouponsList } from "./CouponsList";

// Top-level Coupons surface. Combines:
//   • the QR-to-pay (formerly /pay/qr)
//   • the cashback balance card
//   • the list of saved coupons (formerly the coupons tab on /saved)
//
// All three live on one page rather than under sub-tabs because they
// belong together as one "wallet" mental model: this is where you go
// when you're ABOUT to pay (scan the QR) or AFTER you saved a venue
// (the coupon dropped here automatically per the entity-split trigger).

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/coupons");

  let profile;
  try {
    profile = await apiFetchConsumerProfile(supabase);
  } catch (err) {
    return (
      <div className="flex h-full flex-col">
        <SimpleHeader title="Pay & Win" />
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
      <SimpleHeader title="Pay & Win" />
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
          <MyQrCard code={profile.code} />
          <CashbackBalanceCard
            cashbackBalanceCents={profile.cashback_balance_cents}
          />
          <CouponsList />
        </div>
      </div>
    </div>
  );
}
