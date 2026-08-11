import { TicketScreen } from "@/components/consumer/rewards/TicketScreen";

// THE TICKET route is deliberately THIN (MESITA-1029 S1). Middleware + the
// shell layout own the auth wall, and identity (userId, name, avatar) rides
// ClassProvider from the layout's one per-request profile fetch. Everything
// this page used to do server-side — auth.getUser() plus its own
// consumer-get-profile call — duplicated that work, and because the layout
// does NOT re-run on soft navigation, those two round trips were pure added
// latency on every ticket open: the biggest chunk of the "tap feels frozen"
// delay. Do not add fetches here.
export default async function RewardsTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketScreen ticketId={id} />;
}
