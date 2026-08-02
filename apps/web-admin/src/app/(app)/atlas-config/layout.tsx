import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Atlas Config — a single flat page (no sub-tabs). The profile spec — the
// controlled vocabulary and field limits the Enricher and operators write
// place profiles with. The Enricher's own pipeline behaviour lives on the
// separate Enricher Config page.
export default function AtlasConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      title="Atlas Config"
      description="Atlas Params — who can edit each place field, the controlled vocabulary (categories, tags, facets), and the field limits the Enricher and operators write place profiles with."
    >
      {children}
    </ConfigPageLayout>
  );
}
