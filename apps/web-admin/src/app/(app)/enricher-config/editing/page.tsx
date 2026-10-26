import { ConfigPageLayout } from "@/components/ConfigPageLayout";

export default function EditingConfigPage() {
  return (
    <ConfigPageLayout eyebrow="Operations · Editing" title="Editing">
      <div className="prose prose-sm max-w-none text-muted-foreground">
        <p>
          <strong className="text-foreground">Edit</strong> is an admin hand change to the profile
          fields of one place, saved from the Single Place save bar. A changed link is stored as a
          URL, and its embeddings are queued to refresh.
        </p>
        <p>
          Edit goes through <code>admin-web-update-place</code> only. It does not Sync: Sync is the
          Reviews header and the enrichment draft.
        </p>
      </div>
    </ConfigPageLayout>
  );
}
