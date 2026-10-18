import { PlacesClient } from "@/components/consumer/places/PlacesClient";

export const dynamic = "force-dynamic";

// PLACES — a TEST tab (Pato, MESITA-2402): Home's catalog and Search's map
// merged into one view. Header Location · search · AI; under it Home's
// column beside a Catalog | Map pane. Home and Search are unchanged.
export default function PlacesPage() {
  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  return <PlacesClient apiKey={mapKey} />;
}
