import { notFound, redirect } from "next/navigation";
import { findPlaces, type ClaimablePlace } from "@/lib/business-api";
import { PageHeader } from "@/components/shell/Page";
import { ClaimForm } from "@/components/claim/ClaimForm";
import { placeTabHref } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim your place" };

export default async function ClaimPlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const { placeId } = await params;
  const { added } = await searchParams;
  const found = await findPlaces({ placeId });
  if (!found.ok) throw new Error(found.error);
  const hit = found.data[0];
  if (!hit?.id) notFound();
  const place = hit as ClaimablePlace;
  // Consumer's "Manage this place" comes through here (MESITA-3194): an owner
  // has nothing to claim, so they land on the place.
  if (place.mine === "owner") redirect(placeTabHref(place.id, "profile"));

  return (
    <>
      <PageHeader title={place.name ?? "Claim your place"} sub={place.address ?? undefined} />
      <div className="flex flex-col gap-6">
        {added === "1" ? (
          <p className="border-border bg-muted/50 rounded-xl border px-4 py-3 text-sm">
            We added {place.name ?? "your place"} to Mesita. Tell us who you are there and we&apos;ll review your claim.
          </p>
        ) : null}
        <ClaimForm place={place} />
      </div>
    </>
  );
}
