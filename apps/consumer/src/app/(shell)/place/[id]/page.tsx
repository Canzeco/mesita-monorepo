import { redirect } from "next/navigation";
import { placePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placePath(id, "explore"));
}
