import { PlanModal } from "@/components/consumer/me/PlanModal";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { toGuestPlan, type GuestPlan } from "@/lib/guest-standing";
import { createServerSupabase } from "@/lib/supabase/server";
import { errMsg } from "@/lib/utils";

// /me/plan — the plan you are on, Free or Premier (MESITA-2134, MESITA-2553).
// A failed read shows both plans with neither marked, never a guessed Free.
export const dynamic = "force-dynamic";

export default async function Page() {
  let plan: GuestPlan | null = null;
  try {
    const supabase = await createServerSupabase();
    const { consumer } = await apiFetchConsumerProfile(supabase);
    plan = toGuestPlan(consumer.plan);
  } catch (err) {
    console.error(
      "plan_page_profile_read_failed",
      errMsg(err, "consumer-web-get-profile failed"),
    );
  }
  return <PlanModal plan={plan} />;
}
