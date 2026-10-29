import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { getAtlasSettings } from "../actions";
import { UpdatingClient } from "./UpdatingClient";

export const dynamic = "force-dynamic";

export default async function UpdatingConfigPage() {
  const settings = await getAtlasSettings();

  return (
    <ConfigPageLayout eyebrow="Operations · Updating" title="Updating">
      <div className="space-y-6 pb-24">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            <strong className="text-foreground">Update</strong> refreshes Google factuals. A place
            has one gallery: while it is one photo (Create&apos;s Google hero, never enriched),
            Update replaces that photo with Google&apos;s current hero; a longer gallery is left
            alone. Update never writes Mesita presentation, categories or action states.
          </p>
          <p>
            Update runs by itself every N views (below), from Manage Multiple › Update, or per
            place through <code>admin-web-update-place-google</code>. Enrich rebuilds the gallery
            and writes the full presentation.
          </p>
        </div>
        <UpdatingClient
          initialEveryViews={settings.ok ? settings.data.updateEveryViews ?? 10 : 10}
          initialUpdatedAt={settings.ok ? settings.data.updatedAt : null}
          loadError={settings.ok ? null : settings.error}
        />
      </div>
    </ConfigPageLayout>
  );
}
