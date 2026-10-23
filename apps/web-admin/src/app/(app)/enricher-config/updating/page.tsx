import { ConfigPageLayout } from "@/components/ConfigPageLayout";

export default function UpdatingConfigPage() {
  return (
    <ConfigPageLayout eyebrow="Operations · Updating" title="Updating">
      <div className="prose prose-sm max-w-none text-muted-foreground">
        <p>
          <strong className="text-foreground">Update</strong> refreshes Google factuals and the{" "}
          <code>google_photos</code> catalog only. It never writes Mesita presentation, categories,
          action states, or <code>mesita_photos</code>.
        </p>
        <p>
          Run Update from Manage Multiple › Update or call{" "}
          <code>admin-web-update-place-google</code> per place. Enrich remains the only writer of the
          Mesita photo gallery and full presentation.
        </p>
      </div>
    </ConfigPageLayout>
  );
}
