"use client";

import { useEffect } from "react";
import { notePremierAd } from "@/lib/premier-ads";

/** Counts an ad slot that reached the screen, once per tab (MESITA-4460). */
export function PremierAdBeacon({ placeId, ad }: { placeId: string; ad: boolean }) {
  useEffect(() => {
    if (ad) notePremierAd(placeId, "impression");
  }, [placeId, ad]);
  return null;
}
