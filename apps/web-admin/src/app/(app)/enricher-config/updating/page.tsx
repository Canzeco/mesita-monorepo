import { ConfigPageLayout } from "@/components/ConfigPageLayout";

export default function UpdatingConfigPage() {
  return (
    <ConfigPageLayout eyebrow="Operations · Updating" title="Updating">
      <div className="prose prose-sm max-w-none text-muted-foreground">
        <p>
          <strong className="text-foreground">Update</strong> refreshes Google factuals. A place has
          one gallery: while it is one photo (Create&apos;s Google hero, never enriched), Update
          replaces that photo with Google&apos;s current hero; a longer gallery is left alone. Update
          never writes Mesita presentation, categories or action states.
        </p>
        <p>
          Run Update from Manage Multiple › Update or call{" "}
          <code>admin-web-update-place-google</code> per place. Enrich rebuilds the gallery and writes
          the full presentation.
        </p>
      </div>
    </ConfigPageLayout>
  );
}
