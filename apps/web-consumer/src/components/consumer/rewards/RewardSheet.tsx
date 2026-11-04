"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useOverlayPresence } from "@/components/consumer/overlay/overlay-presence";
import { apiFetchPlaceCard } from "@/lib/api/places";
import { CONSUMER_ROUTES, isRewardStep } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { seededRewardPlace } from "./reward-place-seed";
import { VisitFlow } from "./VisitFlow";

// THE SHEET AT /pay/<place>/<step> (Pato, MESITA-3254: "you actually redirect to
// pay and open the fucking modal there"; "the modal must be full screen"). A state
// overlay's panel, open because of the address. Closing goes to /pay, not back:
// back walks the steps.

export function RewardSheet({ placeId }: { placeId: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const raw = useParams<{ step?: string }>().step;
  const step = raw && isRewardStep(raw) ? raw : "qr";
  const [place, setPlace] = useState(() => seededRewardPlace(placeId));
  const { open, requestClose } = useOverlayPresence(() => router.push(CONSUMER_ROUTES.pay));

  useEffect(() => {
    if (place) return;
    let live = true;
    apiFetchPlaceCard(supabase, placeId).then((card) => {
      if (live && card) setPlace({ name: card.name, photo: card.photos?.[0] ?? null });
    });
    return () => {
      live = false;
    };
  }, [supabase, placeId, place]);

  return (
    <LocalSheet fullScreen open={open} onClose={requestClose} ariaLabel={place ? `Use your reward at ${place.name}` : "Use your reward"}>
      <VisitFlow placeId={placeId} place={place} step={step} onClose={requestClose} />
    </LocalSheet>
  );
}
