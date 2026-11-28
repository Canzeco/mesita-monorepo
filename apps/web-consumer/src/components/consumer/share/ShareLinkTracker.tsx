"use client";

import { useEffect } from "react";
import { useViewer } from "@/lib/identity-context";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { prefetchShareCode, recordShareOpen } from "@/lib/share-code";

// MESITA-5060: on the first screen of a visit, count a share link that was
// opened (`?s=`), and fetch a member's own code so their Share taps carry it.
// Renders nothing.
export function ShareLinkTracker() {
  const viewer = useViewer();
  useEffect(() => {
    const client = createBrowserSupabase();
    recordShareOpen(client);
    if (viewer === "member") void prefetchShareCode(client);
  }, [viewer]);
  return null;
}
