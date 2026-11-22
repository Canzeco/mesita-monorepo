import { redirect } from "next/navigation";
import { StoryPage } from "@/components/consumer/activity/StoryPage";
import { ticketsHref } from "@/lib/ticket-kinds";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /me/tickets/stories/<storyId> — one Story and its steps (MESITA-4405).
// `?by=purchase`: the id is the purchase's, right after a Story buy.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>;
  searchParams: Promise<{ by?: string }>;
}) {
  const [{ storyId }, { by }] = await Promise.all([params, searchParams]);
  if (!isRouteId(storyId)) redirect(ticketsHref("vouchers"));
  return <StoryPage id={storyId} byPurchase={by === "purchase"} />;
}
