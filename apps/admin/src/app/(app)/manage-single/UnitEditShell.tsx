"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { getPlace, type AdminPlace } from "./actions";
import { UnitEditChrome } from "./UnitEditChrome";
import { UnitPlaceProvider } from "./UnitPlaceContext";
import { ErrorNote, Spinner } from "./ui";

export function UnitEditShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [place, setPlace] = useState<AdminPlace | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPlace = useCallback(async (id: string) => {
    setLoadingPlace(true);
    setLoadError(null);
    const r = await getPlace(id);
    setLoadingPlace(false);
    if (!r.ok) {
      setPlace(null);
      setLoadError(r.error);
      return;
    }
    setPlace(r.data);
  }, []);

  useEffect(() => {
    void loadPlace(projectId);
  }, [projectId, loadPlace]);

  if (loadingPlace) {
    return (
      <div className="-mx-4 -mt-8 px-4 pt-8 sm:-mx-6 sm:-mt-12 sm:px-6 lg:-mx-8 lg:px-8">
        <Spinner label="Loading unit…" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="-mx-4 -mt-8 px-4 pt-8 sm:-mx-6 sm:-mt-12 sm:px-6 lg:-mx-8 lg:px-8">
        {loadError && <ErrorNote message={loadError} />}
        <button
          type="button"
          onClick={() => router.push("/manage-single/select")}
          className="border-border hover:border-foreground/40 mt-4 inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition"
        >
          <Search className="h-4 w-4" /> Back to Edit Single Unit
        </button>
      </div>
    );
  }

  return (
    <UnitPlaceProvider
      value={{
        projectId,
        place,
        setPlace,
        reload: () => void loadPlace(projectId),
      }}
    >
      <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-12 lg:-mx-8">
        <UnitEditChrome projectId={projectId} place={place} />

        <div className="px-4 pt-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </UnitPlaceProvider>
  );
}
