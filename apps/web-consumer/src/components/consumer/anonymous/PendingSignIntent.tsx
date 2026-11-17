"use client";

import { useEffect, useRef } from "react";
import { useViewer } from "@/lib/identity-context";
import { takeSignIntent } from "@/lib/anonymous";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";

// THE ACTION THAT SENT THEM TO SIGN, FINISHED (MESITA-4246, design H6). An
// anonymous Save leaves its place id in this tab's sessionStorage (one use,
// 30 minutes, never in a link: a link cannot make anyone save, E5). Once the
// visitor comes back onboarded, the save is applied and said.
export function PendingSignIntent() {
  const viewer = useViewer();
  const { setSaved } = useSavedPlaces();
  const done = useRef(false);
  useEffect(() => {
    if (viewer !== "member" || done.current) return;
    done.current = true;
    const intent = takeSignIntent();
    if (intent?.kind === "save") {
      setSaved(intent.placeId, true);
      toast.success("Saved");
    }
  }, [viewer, setSaved]);
  return null;
}
