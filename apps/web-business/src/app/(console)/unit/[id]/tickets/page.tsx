import { redirect } from "next/navigation";

// Legacy route: /unit/[id]/tickets -> /unit/[id]/scan
export default async function TicketsLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/unit/${id}/scan`);
}
