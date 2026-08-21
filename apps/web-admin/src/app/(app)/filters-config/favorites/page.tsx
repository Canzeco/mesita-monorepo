import { getFiltersConfig } from "../actions";
import { SurfaceConfigClient } from "../SurfaceConfigClient";
import { DEFAULT_FILTERS } from "../filters";

// Filters Config · Favorites — Home's fifth mode (MESITA-1151). Same server-seed
// contract as every other tab: a failed GET becomes loadError and Save stays
// blocked (MESITA-737).
//
// This surface is SHEETLESS: FavoritesList resolves saved ids against the
// shared deck and renders them, with no Filters trigger anywhere on screen. The
// tab exists so the strip matches the five modes HomeModeNav actually ships;
// the client says so in a banner rather than letting empty knobs imply "off".
export const dynamic = "force-dynamic";

export default async function FiltersFavoritesPage() {
  const res = await getFiltersConfig();
  return (
    <SurfaceConfigClient
      surfaceKey="favorites"
      initialConfig={res.ok ? res.config : DEFAULT_FILTERS}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      initialSeeded={res.ok ? res.seeded : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
