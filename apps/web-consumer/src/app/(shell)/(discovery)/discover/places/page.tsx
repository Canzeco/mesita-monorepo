import { Store } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";

// PLACES — Soon for the moment (Pato, MESITA-2168). CatalogRails stays in
// the tree; this page does not mount it, so the Filters control is gone.
export default function DiscoverPlacesPage() {
  return (
    <HomeSoon
      icon={Store}
      name="Places"
      description="Browsing places on Home lands here shortly — thanks for waiting."
    />
  );
}
