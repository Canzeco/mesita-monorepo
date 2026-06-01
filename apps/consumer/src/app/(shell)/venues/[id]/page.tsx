import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Legacy compatibility path. Venue detail now lives on contextual routes:
// /discover/[id] and /saved/[id].

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/place/${id}`);
}
