"use client";

import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function DevelopersSoonFallback() {
  const { place } = usePlaceContext();
  if (place) return null;
  return <SoonStrip {...SOON_STRIPS.developers} />;
}
