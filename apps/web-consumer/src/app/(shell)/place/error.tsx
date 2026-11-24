"use client";

import { PlaceRouteError } from "@/components/consumer/PlaceRouteError";

// The place and its pages (Offers, Reserve, Contact, …) on a failed read
// (MESITA-4917): Back, Try again and Reload.
export default function PlaceError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <PlaceRouteError error={error} retry={retry} />;
}
