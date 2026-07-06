import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { errMsg } from "@/lib/utils";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";
import { PayTabLoading } from "./PayTabLoading";

const PayClient = nextDynamic(
  () => import("./PayClient").then((mod) => mod.PayClient),
  { loading: () => <PayTabLoading /> },
);

export const dynamic = "force-dynamic";

// Rewards is one page: banner + Mesita passport (QR/code) + tickets.
// Legacy /pay/* paths redirect here.
export default async function RewardsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent(CONSUMER_ROUTE_PREFIX.rewards)}`);
  }

  let profile;
  try {
    ({ consumer: profile } = await apiFetchConsumerProfile(supabase));
  } catch (err) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="px-4 py-6">
          <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
            {errMsg(err, "Couldn't load your profile.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PayClient
        userId={user.id}
        code={profile.code ?? ""}
        name={profile.first_name ?? profile.full_name ?? ""}
      />
    </div>
  );
}
