import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { getAtlasSettings } from "../actions";
import { UpdatingClient } from "./UpdatingClient";

export const dynamic = "force-dynamic";

export default async function UpdatingConfigPage() {
  const settings = await getAtlasSettings();

  return (
    <ConfigPageLayout title="Updating">
      <div className="space-y-6 pb-24">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            <strong className="text-foreground">Update</strong> refreshes Google factuals. A place
            has one gallery: while it is one photo (Create&apos;s Google hero, never enriched),
            Update replaces that photo with Google&apos;s current hero; a longer gallery is left
            alone. Update never writes Mesita presentation, categories or action states.
          </p>
          <p>
            Update Google runs by itself every N views (below), from Manage Multiple › Update
            Google, or per place from its Admin page. Enrich rebuilds the gallery and writes the
            full presentation.
          </p>
          <p>
            <strong className="text-foreground">Update Reviews</strong> refreshes Google&apos;s
            stars, up to 100 Google reviews (Apify), and the Instagram and Facebook follower
            counts. It runs every N views too, far less often (each run is a paid scrape), from
            Manage Multiple › Update Reviews, or per place from its Admin page.
          </p>
        </div>
        <UpdatingClient
          initialEveryViews={settings.ok ? settings.data.updateEveryViews ?? 10 : 10}
          initialReviewsEveryViews={settings.ok ? settings.data.reviewsUpdateEveryViews ?? 50 : 50}
          initialUpdatedAt={settings.ok ? settings.data.updatedAt : null}
          loadError={settings.ok ? null : settings.error}
        />
      </div>
    </ConfigPageLayout>
  );
}
