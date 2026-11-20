"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/consumer/nav/Screen";
import { placePath } from "@/lib/consumer-route-contract";
import { goBack } from "@/lib/navigate";
import { cn } from "@/lib/utils";

/** A place subpage (MESITA-4111): the shared header, the place name under
 *  the title, and Back to the place. Contact, Report, Upgrade and a menu
 *  file wear it. */
export function PlaceSubpage({
  title,
  placeName,
  placeId,
  children,
  fill = false,
}: {
  title: string;
  placeName: string;
  placeId: string;
  children: ReactNode;
  /** The body fills the card (the menu viewer). */
  fill?: boolean;
}) {
  const router = useRouter();
  const back = useCallback(
    () => goBack(router, placePath(placeId)),
    [router, placeId],
  );
  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScreenHeader title={title} onBack={back} />
      <p className="text-muted-foreground shrink-0 truncate px-4 pt-2 pb-1 text-center text-xs">
        {placeName}
      </p>
      <div
        className={cn(
          "min-h-0 flex-1",
          fill ? "flex flex-col overflow-hidden" : "overflow-y-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}
