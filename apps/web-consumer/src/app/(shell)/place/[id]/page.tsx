import type { Metadata } from "next";
import { loadPlaceOrLeave, readPlaceOnce } from "@/lib/load-place";
import {
  PLACE_PREVIEW_SIZE,
  placePreviewImagePath,
  placePreviewLine,
} from "@/lib/place-preview";
import { PlaceDetailPageBody } from "@/components/consumer/PlaceDetailPageBody";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// A SHARED PLACE LINK SHOWS THE PLACE (MESITA-4334): its name, its line and
// its own card, not Mesita's generic one. A failed read keeps the root's.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await readPlaceOnce(id).catch(() => null);
  if (!place) return {};
  const line = placePreviewLine(place);
  const image = {
    // The address the link names (its slug), so the card reads the same place.
    url: placePreviewImagePath(id),
    ...PLACE_PREVIEW_SIZE,
    alt: line ? `${place.name} · ${line}` : place.name,
  };
  return {
    title: place.name,
    description: line || undefined,
    openGraph: {
      title: place.name,
      description: line || undefined,
      siteName: "Mesita",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: place.name,
      description: line || undefined,
      images: [image.url],
    },
  };
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  // fallbackHref, not backHref (MESITA-1070): the arrow pops history now, and
  // home is only where it lands when this tab has none to pop.
  return (
    <PlaceDetailPageBody place={place} fallbackHref={CONSUMER_ROUTES.home} />
  );
}
