import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { TicketDetailsRouteClientDynamic } from "@/components/consumer/TicketDetailsRouteClientDynamic";
import { payTicketPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function PayTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(payTicketPath(id))}`);

  return (
    <TicketDetailsRouteClientDynamic userId={user.id} ticketId={id} />
  );
}
