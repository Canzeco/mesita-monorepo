"use client";

// The place layout — the one file that resolves WHICH place, and the only one.
//
// It publishes the place and the caller's tab matrix into `PlaceScope`; every
// view below reads them and fetches nothing. It also 404s: an id that is
// neither held nor in the pool is not a place, and rendering a generic empty
// console for it would let a typo look like a venue with no data.
import { use } from "react";
import { notFound } from "next/navigation";
import { PlaceScopeProvider } from "@/components/console/PlaceScope";
import { useMock } from "@/mock/MockStore";
import { tabsForAccess } from "@/lib/place-tabs";

export default function PlaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { world, scenario, hydrated } = useMock();

  const place = world.places.find((p) => p.id === id) ?? null;
  const pool = world.poolPlaces.find((p) => p.id === id) ?? null;

  // WAIT FOR THE STORE. Before hydration the world is the DEFAULT scenario, and
  // 404ing a place that the stored scenario does hold would send an operator to
  // a dead end their own settings had already opened.
  if (!hydrated) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Opening…
      </p>
    );
  }

  // A FAILED READ IS NOT A 404. It has not established that this place does not
  // exist — only that we could not ask.
  if (!place && !pool && !world.viewerError) notFound();

  return (
    <PlaceScopeProvider
      value={{
        place,
        pool: pool ? { id: pool.id, name: pool.name, category: pool.category, city: pool.city } : null,
        readFailed: world.viewerError,
        tabs: tabsForAccess({
          held: place !== null,
          role: place?.myRole ?? null,
          isSuperAdmin: scenario.isSuperAdmin,
        }),
      }}
    >
      {children}
    </PlaceScopeProvider>
  );
}
