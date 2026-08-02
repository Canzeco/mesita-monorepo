import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";
import { PayTabLoading } from "./PayTabLoading";

const PayClient = nextDynamic(
  () => import("./PayClient").then((mod) => mod.PayClient),
  { loading: () => <PayTabLoading /> },
);

export const dynamic = "force-dynamic";

// Rewards Wallet (MESITA-811): identity header + three steps + New/Pending/
// History; the venue pass modal carries the QR. Legacy /pay/* paths redirect
// here.
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
          <p className={cn(ERROR_BOX_CLASS, "rounded-xl text-sm")}>
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
        name={
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          profile.full_name ||
          ""
        }
      />
    </div>
  );
}
