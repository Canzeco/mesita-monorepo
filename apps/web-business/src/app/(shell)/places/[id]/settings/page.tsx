import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { SettingsTab } from "./SettingsTab";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();
  return <SettingsTab />;
}
