import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { TicketDetailsRouteClient } from "@/components/consumer/TicketDetailsRouteClient";

export const dynamic = "force-dynamic";

export default async function TicketDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(`/pay/tickets/${id}`)}`);

  return <TicketDetailsRouteClient userId={user.id} ticketId={id} />;
}

