"use client";

import { useRouter } from "next/navigation";
import { RouteError } from "@/components/consumer/RouteError";
import { ScreenHeader } from "@/components/consumer/nav/Screen";
import { goBack } from "@/lib/navigate";

// A PLACE THAT COULDN'T BE READ (MESITA-4917). The place screens hide the tab
// bar, so RouteError alone would leave no way out: this one has Back.
export function PlaceRouteError({
  error,
  retry,
  onBack,
}: {
  error: unknown;
  retry: () => void;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="bg-paper pointer-events-auto flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="" onBack={onBack ?? (() => goBack(router))} />
      <RouteError error={error} retry={retry} />
    </div>
  );
}
