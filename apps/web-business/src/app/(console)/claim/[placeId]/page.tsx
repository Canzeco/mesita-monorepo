import { notFound } from "next/navigation";
import { findPlaces } from "@/lib/business-api";
import { getIdentityCached } from "@/lib/identity";
import { PageHeader } from "@/components/shell/Page";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim your place" };

export default async function ClaimPlacePage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const [found, identity] = await Promise.all([findPlaces({ placeId }), getIdentityCached()]);
  if (!found.ok) throw new Error(found.error);
  const place = found.data[0];
  if (!place) notFound();
  const phone = identity.ok ? identity.data.phone : null;
  const hasAccount = identity.ok && identity.data.hasAccount;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={place.name ?? "Claim your place"} sub={place.address ?? undefined} />
      <ClaimForm place={place} signedInPhone={phone} hasAccount={hasAccount} />
    </div>
  );
}
