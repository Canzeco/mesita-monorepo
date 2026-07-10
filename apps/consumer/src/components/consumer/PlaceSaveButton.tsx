"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

// Compact Save control for place-detail headers (page + modal). Lives in the
// top-right so the in-body action row can stay Contact · Reserve · Share.
export function PlaceSaveButton({
  placeId,
  placeName,
  className,
}: {
  placeId: string;
  placeName: string;
  className?: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(placeId);

  function onSavePlace() {
    const nowSaved = !saved;
    toggle(placeId);
    if (nowSaved) {
      toast.action(
        `Saved ${placeName}`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.favorites),
        },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${placeName} from saved`);
    }
  }

  return (
    <button
      type="button"
      onClick={onSavePlace}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save place"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition active:scale-[0.97]",
        saved
          ? "border-primary/35 bg-primary/8 text-primary hover:bg-primary/12"
          : "border-border bg-card text-foreground hover:bg-muted",
        className,
      )}
    >
      <Heart
        className={cn("h-4 w-4", saved && "fill-current")}
        strokeWidth={2.25}
      />
    </button>
  );
}
