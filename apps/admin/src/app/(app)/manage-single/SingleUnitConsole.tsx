"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  BarChart3,
  ChevronRight,
  ImageOff,
  Loader2,
  MapPin,
  Percent,
  QrCode,
  RefreshCcw,
  Search,
  Store,
  Users,
} from "lucide-react";
import {
  getVenue,
  searchVenues,
  type AdminVenue,
  type VenueHit,
} from "./actions";
import { ErrorNote, Spinner } from "./ui";
import { PlaceSection } from "./sections/PlaceSection";
import { PromosSection } from "./sections/PromosSection";
import { ScanSection } from "./sections/ScanSection";
import { PerformanceSection } from "./sections/PerformanceSection";
import { TeamSection } from "./sections/TeamSection";

type Section = "place" | "promos" | "scan" | "performance" | "team";

const NAV: { id: Section; label: string; Icon: typeof MapPin }[] = [
  { id: "place", label: "Place", Icon: MapPin },
  { id: "promos", label: "Promos", Icon: Percent },
  { id: "scan", label: "Scan", Icon: QrCode },
  { id: "performance", label: "Performance", Icon: BarChart3 },
  { id: "team", label: "Team", Icon: Users },
];

export function SingleUnitConsole() {
  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [section, setSection] = useState<Section>("place");
  const [loadingVenue, setLoadingVenue] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVenue = useCallback(async (venueId: string) => {
    setLoadingVenue(true);
    setLoadError(null);
    const r = await getVenue(venueId);
    setLoadingVenue(false);
    if (!r.ok) {
      setLoadError(r.error);
      return;
    }
    setVenue(r.data);
  }, []);

  const reloadVenue = useCallback(async () => {
    if (venue) await loadVenue(venue.id);
  }, [venue, loadVenue]);

  if (loadingVenue) {
    return <Spinner label="Loading venue…" />;
  }

  if (!venue) {
    return (
      <div className="mt-8">
        {loadError && <ErrorNote message={loadError} />}
        <VenuePicker onPick={loadVenue} />
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col-reverse gap-6 lg:flex-row">
      <main className="min-w-0 flex-1">
        {section === "place" && <PlaceSection venue={venue} onSaved={setVenue} />}
        {section === "promos" && <PromosSection venue={venue} onSaved={setVenue} />}
        {section === "scan" && <ScanSection venue={venue} />}
        {section === "performance" && <PerformanceSection venue={venue} />}
        {section === "team" && <TeamSection venue={venue} />}
      </main>

      <RightMenu
        venue={venue}
        section={section}
        onSelect={setSection}
        onChangeVenue={() => {
          setVenue(null);
          setSection("place");
        }}
        onReload={reloadVenue}
      />
    </div>
  );
}

// ── Right-hand venue menu ──────────────────────────────────────────────────

function RightMenu({
  venue,
  section,
  onSelect,
  onChangeVenue,
  onReload,
}: {
  venue: AdminVenue;
  section: Section;
  onSelect: (s: Section) => void;
  onChangeVenue: () => void;
  onReload: () => void;
}) {
  return (
    <aside className="lg:w-64 lg:shrink-0">
      <div className="border-border bg-card sticky top-6 rounded-2xl border p-3">
        {/* Selected venue header */}
        <div className="flex items-start gap-3 p-2">
          <VenueThumb photo={(venue.photos?.[0] as string | undefined) ?? null} name={venue.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{venue.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {venue.category_label ?? venue.category ?? "—"}
              {venue.status ? ` · ${venue.status}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-1 flex gap-1 px-1">
          <button
            type="button"
            onClick={onChangeVenue}
            className="border-border hover:border-foreground/40 inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition"
          >
            <Search className="h-3.5 w-3.5" /> Change venue
          </button>
          <button
            type="button"
            onClick={onReload}
            title="Reload venue"
            className="border-border hover:border-foreground/40 inline-flex h-8 w-8 items-center justify-center rounded-lg border transition"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="mt-3 flex flex-col gap-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground hover:bg-background"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function VenueThumb({ photo, name }: { photo: string | null; name: string }) {
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

// ── Venue picker (search) ──────────────────────────────────────────────────

function VenuePicker({ onPick }: { onPick: (venueId: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<VenueHit[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Debounced search. All state lands inside the timeout callback so nothing
  // is set synchronously within the effect body.
  useEffect(() => {
    const query = q.trim();
    const t = setTimeout(
      () => {
        if (query.length < 2) {
          setHits([]);
          setSearched(false);
          return;
        }
        start(async () => {
          setError(null);
          const r = await searchVenues(query);
          setSearched(true);
          if (!r.ok) {
            setError(r.error);
            setHits([]);
            return;
          }
          setHits(r.data);
        });
      },
      query.length < 2 ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <Store className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">Select venue</h2>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Search by name or slug, or paste a venue id.
      </p>

      <div className="border-border bg-background focus-within:border-foreground mt-5 flex items-center gap-2 rounded-xl border px-3">
        <Search className="text-muted-foreground h-4 w-4 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Tetetlán, café, a venue id…"
          autoFocus
          className="h-11 flex-1 bg-transparent text-sm outline-none"
        />
        {pending && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
      </div>

      {error && <ErrorNote message={error} />}

      <div className="mt-4 flex flex-col gap-2">
        {hits.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onPick(v.id)}
            className="border-border bg-background hover:border-foreground/40 flex items-center gap-3 rounded-xl border p-3 text-left transition"
          >
            <VenueThumb photo={v.photo} name={v.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{v.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {v.category_label ?? v.category ?? "—"}
                {v.status ? ` · ${v.status}` : ""}
                {v.address ? ` · ${v.address}` : ""}
              </p>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          </button>
        ))}
        {searched && !pending && hits.length === 0 && !error && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No venues match “{q.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
