"use client";

// The opening route (MESITA-2311) for a Google-only place opened from Home,
// Favorites or a pasted link: the generating view (GeneratingPlace,
// MESITA-2935) while get-or-create runs, then this route is replaced by the
// real profile, and the card the guest tapped turns into the Mesita card in
// Home's catalog and Search's carousel behind it (lib/created-places.ts,
// MESITA-2683). It drew a draft profile with a Creating fact and Google's
// photo until MESITA-2935 (Pato: "this ugly ass ui"); the stash now only
// lends the name and address. A refusal says why, with Try again. It creates
// from a client effect only, after a deliberate tap navigated here: never on
// the server, never on a prefetch. Search never lands here: its Generate
// dialog confirms and awaits the create itself.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";
import { navigateTo } from "@/lib/navigate";
import {
  clearPendingPlace,
  parsePendingPlace,
  readPendingPlaceRaw,
} from "@/lib/pending-place";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { getOrCreateGooglePlace } from "@/lib/use-open-google-place";
import { errMsg } from "@/lib/utils";

const subscribeNever = () => () => {};

export function OpeningGooglePlace({
  gid,
  name,
  variant,
}: {
  gid: string;
  /** The name the tap sent along; the stashed card's name wins when present. */
  name: string;
  /** "modal" inside the place slide-over, "page" on a hard load. */
  variant: "modal" | "page";
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  // The card the guest tapped. The server snapshot is empty so the first
  // client paint agrees with it; the stash fills the name right after.
  const raw = useSyncExternalStore(
    subscribeNever,
    () => readPendingPlaceRaw(gid),
    () => null,
  );
  const card = useMemo(() => parsePendingPlace(raw), [raw]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const title = card?.name ?? (name.trim() || null);

  // The create, awaited: one shared request per Google Place ID. Landed,
  // this route becomes the real profile; the lists behind it swap the card
  // themselves (getOrCreateGooglePlace).
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const opened = await getOrCreateGooglePlace(supabase, gid);
        clearPendingPlace(gid);
        if (!live) return;
        if (opened.created) {
          toast.success(`${title ?? "This place"} is on Mesita. Vote to enrich its profile.`);
        }
        // The slide-over replaces itself in place. A hard-loaded page must
        // load the real profile as a page: a soft replace from here lets the
        // (.)place intercept paint the profile as a modal over this screen,
        // with no history entry for its Back to pop.
        if (variant === "page") window.location.replace(opened.href);
        else navigateTo(router, opened.href, { replace: true });
      } catch (err) {
        if (live) setError(errMsg(err, "Couldn't generate that profile right now."));
      }
    })();
    return () => {
      live = false;
    };
    // The name only decorates the toast; a retry is `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, router, supabase, variant, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <GeneratingPlaceScreen
      variant={variant}
      name={title}
      address={card?.address ?? null}
      error={error}
      onRetry={retry}
    />
  );
}
