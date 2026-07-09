import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";
import { ComingSoonSurface } from "@/components/consumer/ComingSoonSurface";

export const dynamic = "force-dynamic";

// Rewards is parked behind a "Soon" gate for now — the real surface (banner +
// Mesita passport + tickets) isn't live yet, so this renders a single premium
// coming-soon panel. PayClient / PayTabLoading and the ticket detail routes
// stay in the tree, unused, for an easy un-park once rewards ships.
export default async function RewardsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent(CONSUMER_ROUTE_PREFIX.rewards)}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ComingSoonSurface
        icon={<QrCode className="h-7 w-7" strokeWidth={2} />}
        title="Rewards"
        body="Your Mesita passport — QR check-ins, tickets, and rewards at your favorite places — is almost ready. We'll let you know the moment it goes live."
      />
    </div>
  );
}
