"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Screen } from "@/components/consumer/nav/Screen";
import { AddPlaceSheet } from "@/components/consumer/search/AddPlaceSheet";
import { generateHref } from "@/components/consumer/search/GeneratePlaceDialog";
import { predictionOnMesita } from "@/components/consumer/search/search-pins";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import { goBack } from "@/lib/navigate";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { useOpenPlaceHref } from "@/lib/use-open-place-href";

// Add a place (MESITA-4113). The map's camera rides along as lat/lng so
// Google stays biased to where the guest was looking.
function AddPlaceBody() {
  const params = useSearchParams();
  const router = useRouter();
  const open = useOpenPlaceHref();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const origin =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : MONTERREY_CENTER;

  return (
    <Screen title="Add a place" scrolls onBack={() => goBack(router)}>
      <AddPlaceSheet
        origin={origin}
        onClose={() => goBack(router)}
        onPick={(row) => {
          if (predictionOnMesita(row)) {
            const id = row.mesitaSlug || row.mesitaId;
            if (id) open(placeHref(id));
            else {
              toast(
                "This place is on Mesita but isn't in the map snapshot yet — opening it from search is coming soon.",
              );
            }
            return;
          }
          open(
            generateHref({
              gid: row.placeId,
              name: row.mainText,
              address: row.secondaryText || null,
            }),
          );
        }}
      />
    </Screen>
  );
}

export default function AddPlacePage() {
  return (
    <Suspense>
      <AddPlaceBody />
    </Suspense>
  );
}
