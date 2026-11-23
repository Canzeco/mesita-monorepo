import { redirect } from "next/navigation";
import { StoryTicket } from "@/components/consumer/activity/StoryTicket";
import { ticketsHref } from "@/lib/ticket-kinds";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /me/tickets/stories/<storyId> — one Instagram story's ticket, its five
// steps (MESITA-4747). A 308 to the Stories tab until then (MESITA-4738).
export default async function Page({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!isRouteId(storyId)) redirect(ticketsHref("stories"));
  return <StoryTicket storyId={storyId} />;
}
