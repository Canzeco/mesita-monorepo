import type { Seed } from "@/lib/mock/credits-emulator";

// Which seed the /credits emulator starts from on a first visit.
//
// Read on the SERVER, in page.tsx, and passed down as a prop — never through
// useSearchParams(). A client-side search-param read without a <Suspense>
// boundary de-opts the whole route and fails `next build`; this package has
// already paid for that twice ((shell)/layout.tsx's PlaceGoneNotice wrapper
// and RouteBadge's split). Keeping it a pure function also makes it the one
// piece of the demo plumbing that is unit-testable in a node-env harness.
//
// It only bites on a FIRST load or after Reset — once the emulator has written
// state to localStorage, that state wins. Reset re-seeds from this same value.

export function parseCreditsDemo(
  searchParams: Record<string, string | string[] | undefined>,
): Seed {
  const raw = searchParams.demo;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "empty" ? "empty" : "default";
}
