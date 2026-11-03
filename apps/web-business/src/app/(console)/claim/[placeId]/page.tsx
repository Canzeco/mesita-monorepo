import { notFound } from "next/navigation";
import { findPlaces, type ClaimablePlace } from "@/lib/business-api";
import { PageHeader } from "@/components/shell/Page";
import { ClaimForm } from "@/components/claim/ClaimForm";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={place.name ?? "Claim your place"} sub={place.address ?? undefined} />
      {added === "1" ? (
        <p className="border-border bg-muted/50 rounded-xl border px-4 py-3 text-sm">
          We added {place.name ?? "your place"} to Mesita. Tell us who you are there and we&apos;ll review your claim.
        </p>
      ) : null}
      <ClaimForm place={place} />
    </div>
  );
}
