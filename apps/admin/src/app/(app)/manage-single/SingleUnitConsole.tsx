"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ImageOff, RefreshCcw, Search } from "lucide-react";
import { getVenue, type AdminVenue } from "./actions";
import { isUnitSection, UNIT_SECTIONS, type UnitSection } from "./nav";
import { ErrorNote, Spinner } from "./ui";
import { PlaceSection } from "./sections/PlaceSection";
import { PromosSection } from "./sections/PromosSection";
import { ScanSection } from "./sections/ScanSection";
import { PerformanceSection } from "./sections/PerformanceSection";
import { TeamSection } from "./sections/TeamSection";

export function SingleUnitConsole({ unitId }: { unitId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sectionParam = searchParams.get("section");
  const section: UnitSection = isUnitSection(sectionParam) ? sectionParam : "place";

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

  const changeUnit = () => {
    router.push("/manage-single/select");
  };

  if (loadingVenue) {
    return <Spinner label="Loading unit…" />;
  }

  if (!venue) {
    return (
      <div>
        {loadError && <ErrorNote message={loadError} />}
        <button
          type="button"
          onClick={changeUnit}
          className="border-border hover:border-foreground/40 mt-4 inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition"
        >
          <Search className="h-4 w-4" /> Back to Edit Single Unit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <MobileUnitNav
        unitId={unitId}
        venue={venue}
        section={section}
        onChangeUnit={changeUnit}
        onReload={() => void loadVenue(unitId)}
      />

      <main className="min-w-0">
        {section === "place" && <PlaceSection venue={venue} onSaved={setVenue} />}
        {section === "promos" && <PromosSection venue={venue} onSaved={setVenue} />}
        {section === "scan" && <ScanSection venue={venue} />}
        {section === "performance" && <PerformanceSection venue={venue} />}
        {section === "team" && <TeamSection venue={venue} />}
      </main>
    </div>
  );
}

function MobileUnitNav({
  unitId,
  venue,
  section,
  onChangeUnit,
  onReload,
}: {
  unitId: string;
  venue: AdminVenue;
  section: UnitSection;
  onChangeUnit: () => void;
  onReload: () => void;
}) {
  return (
    <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-20 -mx-4 rounded-none border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
      <div className="flex items-start gap-3">
        <UnitThumb photo={(venue.photos?.[0] as string | undefined) ?? null} name={venue.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{venue.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {venue.category_label ?? venue.category ?? "—"}
            {venue.status ? ` · ${venue.status}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onReload}
          title="Reload unit"
          className="border-border hover:border-foreground/40 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onChangeUnit}
          className="border-border hover:border-foreground/40 inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition"
        >
          <Search className="h-3.5 w-3.5" /> Change unit
        </button>
      </div>
      <nav
        aria-label="Unit sections"
        className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {UNIT_SECTIONS.map(({ id, label, Icon }) => {
          const active = section === id;
          const href = `/manage-single/${unitId}?section=${id}`;
          return (
            <Link
              key={id}
              href={href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-foreground text-background"
                  : "border-border bg-background text-foreground border"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function UnitThumb({ photo, name }: { photo: string | null; name: string }) {
  if (!photo) {
    return (
      <div className="border-border bg-background text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      className="border-border h-11 w-11 shrink-0 rounded-lg border object-cover"
    />
  );
}
