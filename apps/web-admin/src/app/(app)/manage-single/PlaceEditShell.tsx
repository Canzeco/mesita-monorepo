"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { getPlace, type AdminPlace } from "./actions";
import { PlaceEditChrome } from "./PlaceEditChrome";
import { PlaceProvider } from "./PlaceContext";
import {Spinner} from "./ui";
import { ErrorNote } from "@/components/ErrorNote";

export function PlaceEditShell({
  projectId,
  children }: {
  projectId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [place, setPlace] = useState<AdminPlace | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reqRef = useRef(0);

  // Loading is derived, not stored: the shell shows the spinner whenever the
  // last-loaded id lags the requested projectId. This keeps the effect free of
  // synchronous setState and makes stale responses harmless (reqRef guards the
  // write). reload() re-fetches in the background without flashing the spinner.
  const loadPlace = useCallback(async (id: string) => {
    const req = ++reqRef.current;
    const r = await getPlace(id);
    if (req !== reqRef.current) return; // superseded by a newer request
    if (!r.ok) {
      setPlace(null);
      setLoadError(r.error);
    } else {
      setPlace(r.data);
      setLoadError(null);
    }
    setLoadedId(id);
  }, []);

  // A write EF re-reads the place with PLACE_BUSINESS_COLUMNS and nothing
  // else, so its response drops every admin-only extra the overview attached —
  // the embedding columns, and now the Status block. MERGE it over the loaded
  // place rather than replacing: every real column is present in the response
  // (so a cleared field still clears), and the extras survive the save.
  const mergePlace = useCallback((next: AdminPlace) => {
    setPlace((prev) => (prev ? { ...prev, ...next } : next));
  }, []);

  // Fetch inline (not via loadPlace) so every setState sits after the await —
  // the same reqRef guard makes a superseded response a no-op.
  useEffect(() => {
    const req = ++reqRef.current;
    void (async () => {
      const r = await getPlace(projectId);
      if (req !== reqRef.current) return;
      if (!r.ok) {
        setPlace(null);
        setLoadError(r.error);
      } else {
        setPlace(r.data);
        setLoadError(null);
      }
      setLoadedId(projectId);
    })();
  }, [projectId]);

  const loadingPlace = loadedId !== projectId;

  if (loadingPlace) {
    return (
      <div className="px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <Spinner label="Loading place…" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {loadError && <ErrorNote message={loadError} />}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setLoadedId(null);
              void loadPlace(projectId);
            }}
            className="bg-foreground text-background inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition hover:opacity-90"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => router.push("/manage-single/select")}
            className="border-border hover:border-foreground/40 inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition"
          >
            <Search className="h-4 w-4" /> Back to Manage Single Place
          </button>
        </div>
      </div>
    );
  }

  return (
    <PlaceProvider
      projectId={projectId}
      place={place}
      setPlace={mergePlace}
      reload={() => void loadPlace(projectId)}
    >
      {/* Chrome is full-bleed across the main column; body keeps page padding. */}
      <div className="w-full">
        <PlaceEditChrome projectId={projectId} place={place} />
        <div className="px-4 pt-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </PlaceProvider>
  );
}
