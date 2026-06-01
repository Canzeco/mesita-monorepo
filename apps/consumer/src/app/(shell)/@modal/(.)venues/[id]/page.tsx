import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Legacy intercepted path. Route callers to the new contextual detail URL.

export default async function VenueModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/discover/swipe/${id}`);
}
