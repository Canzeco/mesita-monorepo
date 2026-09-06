import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { AdminTab } from "./AdminTab";

export const dynamic = "force-dynamic";

export default async function PlaceAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  // Operator internals. The tab row never offers this to a restaurant, and
  // this refuses it outright — a typed URL is not a capability.
  if (!manage || !manage.isSuperAdmin) notFound();
  return <AdminTab />;
}
