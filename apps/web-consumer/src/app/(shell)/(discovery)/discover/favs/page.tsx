import { Heart } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";

// FAVS — Soon for the moment (Pato, MESITA-2168). FavoritesList stays in
// the tree; this page does not mount it.
export default function DiscoverFavsPage() {
  return (
    <HomeSoon
      icon={Heart}
      name="Favs"
      description="Your saved places land here shortly — thanks for waiting."
    />
  );
}
