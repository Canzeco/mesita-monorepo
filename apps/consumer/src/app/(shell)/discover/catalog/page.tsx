import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendCatalog,
  apiFetchPublicVenues,
  type CatalogCategory,
  type Venue,
} from "@/lib/api/venues";
import { enrichVenueOverview } from "@/lib/mock/enrich-overview";
import { VenueCatalogCard } from "@/components/consumer/VenueCatalogCard";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Catalog is driven by consumer-recommend-catalog: an LLM proposes up to 10
// category rows specific to THIS user's pool, time, and (when wired) past
// taste. Each row is then RAG-ranked against an intent_query. If the EF
// isn't deployed yet (or fails), we degrade gracefully to a hard-coded
// trio: "Best cashback" / "New on Mesita" / "Other places nearby".
export default async function CatalogPage() {
  const supabase = await createServerSupabase();

  let categories: CatalogCategory[] = [];
  let fallback: Venue[] = [];
  let fetchError: string | null = null;

  try {
    const result = await apiRecommendCatalog(supabase, {
      maxCategories: 10,
      perCategory: 10,
    });
    categories = result.categories.map((c) => ({
      ...c,
      venues: c.venues.map(enrich),
    }));
  } catch (err) {
    console.warn(
      "[catalog] consumer-recommend-catalog failed, falling back:",
      err,
    );
    try {
      const list = await apiFetchPublicVenues(supabase, 60);
      fallback = list.map(enrich);
    } catch (err2) {
      fetchError = errMsg(err2, "Couldn't load the catalog.");
    }
  }

  if (fetchError) {
    return (
      <div className="px-4 pt-4 pb-6">
        <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
          {fetchError}
        </p>
      </div>
    );
  }

  if (categories.length === 0 && fallback.length === 0) {
    return (
      <div className="px-4 pt-6 pb-6 text-center">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          No venues yet
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          As partners onboard, their venues land here.
        </p>
      </div>
    );
  }

  // Curated path — the EF gave us proper rows.
  if (categories.length > 0) {
    return (
      <div className="pb-6">
        {categories.map((c) => (
          <Row
            key={c.key}
            title={`${c.emoji} ${c.label}`}
            subtitle={c.description}
            venues={c.venues}
          />
        ))}
      </div>
    );
  }

  // Fallback path — derive the three legacy rows from the flat list.
  const partners = fallback.filter((v) => v.listing_type === "partner");
  const cashbackTop = [...partners]
    .filter((v) => (v.cashback_percent ?? 0) > 0)
    .sort((a, b) => (b.cashback_percent ?? 0) - (a.cashback_percent ?? 0))
    .slice(0, 12);
  const newest = [...fallback].slice(0, 12);
  const webListings = fallback
    .filter((v) => v.listing_type === "web")
    .slice(0, 12);

  return (
    <div className="pb-6">
      {cashbackTop.length > 0 && (
        <Row
          title="Best cashback"
          subtitle="Most back on the bill"
          venues={cashbackTop}
        />
      )}
      <Row
        title="New on Mesita"
        subtitle="Recently onboarded venues"
        venues={newest}
      />
      {webListings.length > 0 && (
        <Row
          title="Other places nearby"
          subtitle="Web listings — no cashback yet"
          venues={webListings}
        />
      )}
    </div>
  );
}

const enrich = (v: Venue) => enrichVenueOverview(v, "catalog");

function Row({
  title,
  venues,
}: {
  title: string;
  // subtitle kept on the EF response and the fallback paths above for future
  // surfaces, but the catalog row now renders title-only — the description
  // line was too dense above the horizontal card scroll.
  subtitle?: string;
  venues: Venue[];
}) {
  return (
    <section className="mt-6">
      <div className="px-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
        {venues.map((v) => (
          <div key={v.id} className="w-64 flex-shrink-0">
            <VenueCatalogCard venue={v} />
          </div>
        ))}
      </div>
    </section>
  );
}
