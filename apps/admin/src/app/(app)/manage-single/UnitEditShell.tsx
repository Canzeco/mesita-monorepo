"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { getVenue, type AdminVenue } from "./actions";
import { UnitEditChrome } from "./UnitEditChrome";
import { UnitVenueProvider } from "./UnitVenueContext";
import { ErrorNote, Spinner } from "./ui";

export function UnitEditShell({
  unitId,
  children,
}: {
  unitId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVenue = useCallback(async (id: string) => {
    setLoadingVenue(true);
    setLoadError(null);
    const r = await getVenue(id);
    setLoadingVenue(false);
    if (!r.ok) {
      setVenue(null);
      setLoadError(r.error);
      return;
    }
    setVenue(r.data);
  }, []);

  useEffect(() => {
    void loadVenue(unitId);
  }, [unitId, loadVenue]);

  if (loadingVenue) {
    return (
      <div className="-mx-4 -mt-8 px-4 pt-8 sm:-mx-6 sm:-mt-12 sm:px-6 lg:-mx-8 lg:px-8">
        <Spinner label="Loading unit…" />
      </div>
    );
  }

  if (!venue) {
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
    <UnitVenueProvider
      value={{
        unitId,
        venue,
        setVenue,
        reload: () => void loadVenue(unitId),
      }}
    >
      <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-12 lg:-mx-8">
        <UnitEditChrome unitId={unitId} venue={venue} />

        <div className="px-4 pt-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </UnitVenueProvider>
  );
}
