// Which fixture the /credits spike renders.
//
// Read on the SERVER, in page.tsx, and passed down as a prop — never through
// useSearchParams(). A client-side search-param read without a <Suspense>
// boundary de-opts the whole route and fails `next build`; this package has
// already paid for that twice ((shell)/layout.tsx's PlaceGoneNotice wrapper
// and RouteBadge's split). Keeping it a pure function also makes it the one
// piece of the demo plumbing that is unit-testable in a node-env harness.

export type CreditsDemoVariant = "stack" | "solo" | "empty";

export function parseCreditsDemo(
  searchParams: Record<string, string | string[] | undefined>,
): CreditsDemoVariant {
  const raw = searchParams.demo;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "solo") return "solo";
  if (value === "empty") return "empty";
  // The stack is the default because the question being asked is "how does it
  // feel to hold several of these" — that has to be what loads.
  return "stack";
}
