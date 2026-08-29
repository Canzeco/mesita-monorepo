import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Favorites is parked with the rest of Home. Unpark via HomeModeNav + remounting
// FavoritesList (the page body is in git history).
export default function HomeFavoritesPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
