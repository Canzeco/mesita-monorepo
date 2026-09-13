import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { getSelection } from "@/lib/selected-place";
import { AdminTab } from "./AdminTab";

export const dynamic = "force-dynamic";

export default async function PlaceAdminPage() {
  const { placeId } = await getSelection();
  const manage = placeId ? await getManagePlace(placeId) : null;
  // Operator internals. The tab row never offers this to a restaurant, and
  // this refuses it outright — a typed URL is not a capability.
  if (!manage || !manage.isSuperAdmin) notFound();
  return <AdminTab />;
}
