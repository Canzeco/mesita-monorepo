import { PageContainer, PageHeader } from "@/components/PageContainer";

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
    <PageContainer>
      <PageHeader
        title="Atlas Config"
        description="Atlas Params — the controlled vocabulary and field limits the Enricher and operators write place profiles with."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
