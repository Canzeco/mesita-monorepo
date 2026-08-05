import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { TicketScreen } from "@/components/consumer/rewards/TicketScreen";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { rewardsTicketPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// THE ticket (MESITA-857 · MESITA-908): Place → Consumer → Reward → Tasks →
// QR / Results → Report. Profile seeds the Consumer Info block.
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

  let guestName: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const { consumer } = await apiFetchConsumerProfile(supabase);
    const first = consumer.first_name?.trim() ?? "";
    const last = consumer.last_name?.trim() ?? "";
    guestName =
      [first, last].filter(Boolean).join(" ") ||
      consumer.full_name?.trim() ||
      null;
    avatarUrl = consumer.avatar_url ?? null;
  } catch {
    // Consumer bar falls back to "Mesita guest" + DefaultAvatar.
  }

  return (
    <TicketScreen
      userId={user.id}
      ticketId={id}
      guestName={guestName}
      avatarUrl={avatarUrl}
    />
  );
}
