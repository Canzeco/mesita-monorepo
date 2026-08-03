import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { TicketScreen } from "@/components/consumer/rewards/TicketScreen";
import { rewardsTicketPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// THE ticket (MESITA-857): one full-screen object for the whole lifecycle —
// place hero, class-tinted pass with the QR, the task checklist, the reward
// strip. Replaces the pre-wallet TicketDetails flow.
export default async function RewardsTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(rewardsTicketPath(id))}`);

  return <TicketScreen userId={user.id} ticketId={id} />;
}
