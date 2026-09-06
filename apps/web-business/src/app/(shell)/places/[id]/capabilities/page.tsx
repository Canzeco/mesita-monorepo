import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { CapabilitiesTab } from "./CapabilitiesTab";

export const dynamic = "force-dynamic";

export default async function CapabilitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return <CapabilitiesTab />;
}
