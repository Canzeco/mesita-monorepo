"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/shared";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import { PlaceDetailPageHeader } from "@/components/consumer/PlaceDetailPageHeader";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { getOrCreateGooglePlace } from "@/lib/use-open-google-place";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";

// The opening screen (MESITA-2311): a Google-only place the guest tapped,
// shown at once with its name and a spinner while get-or-create runs, then
// replaced by the real profile. It creates from a client effect only, after
// a deliberate tap navigated here: never on the server, never on a prefetch.

export function OpeningGooglePlace({
  gid,
  name,
  variant,
}: {
  gid: string;
  name: string;
  /** "modal" inside the place slide-over, "page" on a hard load. */
  variant: "modal" | "page";
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const title = name || "Opening place";

  useEffect(() => {
    let live = true;
    getOrCreateGooglePlace(supabase, gid)
      .then((opened) => {
        if (!live) return;
        if (opened.created) {
          toast.success(`${title} is on Mesita. Vote to enrich its profile.`);
        }
        router.replace(opened.href);
      })
      .catch((err) => {
        if (live) setError(errMsg(err, "Couldn't open that place right now."));
      });
    return () => {
      live = false;
    };
  }, [supabase, router, gid, title, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <>
      {variant === "modal" ? (
        <SlideOverHeader title={title} />
      ) : (
        <PlaceDetailPageHeader placeId={gid} placeName={title} />
      )}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        {error ? (
          <>
            <p className="text-sm font-semibold">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="bg-foreground text-paper rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <Spinner size="lg" label={`Opening ${title}`} />
            <p className="text-muted-foreground text-sm">Opening {title}…</p>
          </>
        )}
      </div>
    </>
  );
}
