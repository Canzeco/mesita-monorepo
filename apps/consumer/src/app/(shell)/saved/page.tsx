"use client";

import { useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { SavedItemCard } from "@/components/consumer/SavedItemCard";
import { TicketSheet } from "@/components/consumer/TicketSheet";
import { VenueCatalogCard } from "@/components/consumer/VenueCatalogCard";
import { RESERVATIONS, COUPONS, SAVED_VENUES } from "@/lib/consumer-data";
import type { SavedItem } from "@/lib/consumer-data";
import { mockVenue } from "@/lib/mock/venue";
import { useSavedVenues } from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import type { Venue } from "@/lib/api/venues";
import { cn } from "@/lib/utils";

// Catalog of venue rows the /saved page can resolve localStorage ids
// against. Combines the seed fixtures + a row synthesized from mockVenue
// so a save from /venues/[id] (which currently always resolves to
// Mochomos) renders correctly here. Once the real backend lands this
// becomes a consumer-list-saved-venues EF call.
function buildVenueCatalog(): Map<string, Venue> {
  const cat = new Map<string, Venue>();
  for (const v of SAVED_VENUES) cat.set(v.id, v as Venue);
  // mockVenue is the VenueDetail shape; project the subset Venue needs
  // for the catalog tile (name / category / lat / lng / photos / ...).
  // Cast guarded by the runtime null-checks in VenueCatalogCard.
  const mvAsVenue: Venue = {
    id: mockVenue.id,
    slug: mockVenue.id,
    name: mockVenue.name,
    category: mockVenue.category,
    vibe: mockVenue.vibe,
    price_level: mockVenue.price_level,
    currency: mockVenue.currency,
    listing_type: mockVenue.listing_type,
    status: "active",
    fiscal_type: "formal",
    plan: "formal_pro",
    lat: null,
    lng: null,
    address: mockVenue.address,
    closes_at: mockVenue.closes_at,
    phone: null,
    pitch: null,
    story: null,
    cashback_percent: 20,
    photos: mockVenue.photos.slice(0, 1),
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
  } as unknown as Venue;
  cat.set(mvAsVenue.id, mvAsVenue);
  return cat;
}

type Tab = "venues" | "reservations" | "coupons";
type ResFilter = "upcoming" | "past" | "cancelled";
type CouponFilter = "active" | "used" | "expired";

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("venues");
  const [resFilter, setResFilter] = useState<ResFilter>("upcoming");
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("active");
  const [openItem, setOpenItem] = useState<SavedItem | null>(null);

  // Source of truth for "what venues has the user bookmarked" — backed by
  // localStorage via useSavedVenues. The fixture seed (SAVED_VENUES) is
  // imported on first mount: if the localStorage set is empty AND the user
  // hasn't explicitly emptied it, we preload from the fixtures so the
  // preview screen isn't blank on first visit.
  const { savedIds, setSaved } = useSavedVenues();
  const catalog = useMemo(() => buildVenueCatalog(), []);
  const venues = useMemo<Venue[]>(() => {
    const ids = [...savedIds];
    // First visit: localStorage hasn't been seeded yet. Surface the
    // fixture list so the page reads as populated.
    if (ids.length === 0) return SAVED_VENUES as Venue[];
    return ids
      .map((id) => catalog.get(id))
      .filter((v): v is Venue => v != null);
  }, [savedIds, catalog]);

  function unsaveVenue(id: string) {
    const v = catalog.get(id);
    setSaved(id, false);
    if (v) toast(`Removed ${v.name} from saved`);
  }

  return (
    <div className="relative flex h-full flex-col">
      <SimpleHeader title="Mesita" eyebrow="Saved" />

      <div className="px-4 pt-3">
        <p className="bg-secondary/10 text-secondary rounded-xl px-3 py-2 text-[11px]">
          Preview — saved items aren&apos;t connected to the backend yet. The
          flow below is a sketch of what&apos;s coming.
        </p>
      </div>

      <div className="px-4 pt-4">
        <div className="border-border bg-card flex rounded-full border p-1">
          <TabButton
            active={tab === "venues"}
            onClick={() => setTab("venues")}
            label="Venues"
            count={venues.length}
          />
          <TabButton
            active={tab === "reservations"}
            onClick={() => setTab("reservations")}
            label="Reservations"
            count={8}
          />
          <TabButton
            active={tab === "coupons"}
            onClick={() => setTab("coupons")}
            label="Coupons"
            count={35}
          />
        </div>
      </div>

      {tab !== "venues" && (
        <div className="px-4 pt-3">
          <div className="border-border bg-card scrollbar-hide flex gap-1 overflow-x-auto rounded-full border p-1">
            {tab === "reservations"
              ? (
                  [
                    { id: "upcoming", label: "Upcoming", count: 4 },
                    { id: "past", label: "Past", count: 2 },
                    { id: "cancelled", label: "Cancelled", count: 2 },
                  ] as { id: ResFilter; label: string; count: number }[]
                ).map((f) => (
                  <FilterPill
                    key={f.id}
                    active={resFilter === f.id}
                    onClick={() => setResFilter(f.id)}
                    label={f.label}
                    count={f.count}
                  />
                ))
              : (
                  [
                    { id: "active", label: "Active", count: 29 },
                    { id: "used", label: "Used", count: 4 },
                    { id: "expired", label: "Expired", count: 2 },
                  ] as { id: CouponFilter; label: string; count: number }[]
                ).map((f) => (
                  <FilterPill
                    key={f.id}
                    active={couponFilter === f.id}
                    onClick={() => setCouponFilter(f.id)}
                    label={f.label}
                    count={f.count}
                  />
                ))}
          </div>
        </div>
      )}

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-4">
        {tab === "venues" ? (
          venues.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {venues.map((v) => (
                <SavedVenueTile
                  key={v.id}
                  venue={v}
                  onUnsave={() => unsaveVenue(v.id)}
                />
              ))}
            </div>
          )
        ) : tab === "reservations" ? (
          resFilter === "upcoming" ? (
            <div className="flex flex-col gap-3">
              {RESERVATIONS.map((r) => (
                <SavedItemCard
                  key={r.id}
                  item={r}
                  onClick={() => setOpenItem(r)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )
        ) : couponFilter === "active" ? (
          <div className="flex flex-col gap-3">
            {COUPONS.map((c) => (
              <SavedItemCard
                key={c.id}
                item={c}
                onClick={() => setOpenItem(c)}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {openItem && (
        <TicketSheet item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0 text-[9px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// Wraps VenueCatalogCard with an overlay "saved" toggle. The card itself
// is unchanged — VenueCatalogCard already handles the verified-partner vs
// web-listed badge contextually (cashback/discount pill only renders on
// partner rows). The bookmark button stops propagation so tapping it
// doesn't follow the underlying link.
function SavedVenueTile({
  venue,
  onUnsave,
}: {
  venue: Venue;
  onUnsave: () => void;
}) {
  return (
    <div className="relative">
      <VenueCatalogCard venue={venue} />
      <button
        type="button"
        aria-label="Remove from saved"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnsave();
        }}
        className="bg-background/95 text-foreground hover:bg-background absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur transition"
      >
        <Bookmark className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
      Nothing here yet.
    </div>
  );
}
