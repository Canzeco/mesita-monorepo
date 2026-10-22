import { MeScreen } from "@/components/consumer/me/MeScreen";
import { FavoritesSkeleton } from "@/components/consumer/saved/FavoritesPage";

// /me/favorites' fallback: the page's own frame — MeScreen's bar, its title
// and a back button that already works — over the white pane of Search's
// horizontal cards, one per row (Pato, MESITA-2701: "the placeholders must
// be similar to the page you are loading, like the sizes").
export default function FavoritesLoading() {
  return (
    <MeScreen title="Favorites" flush>
      <FavoritesSkeleton />
      <p role="status" className="sr-only">
        Loading favorites
      </p>
    </MeScreen>
  );
}
