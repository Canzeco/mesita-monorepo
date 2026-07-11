import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Atlas Config — the profile spec: the controlled vocabulary (categories, tags,
// facets) and field limits the Enricher and operators write place profiles with.
// A single flat page (no sub-tabs); the Enricher's pipeline behaviour lives on
// the separate Enricher Config page.
export default function AtlasConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      title="Atlas Config"
      description="Atlas Params — who can edit each place field, the controlled vocabulary, and field limits the Enricher and operators write place profiles with."
    >
      {children}
    </ConfigPageLayout>
  );
}
