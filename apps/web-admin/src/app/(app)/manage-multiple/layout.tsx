import { PageContainer, PageHeader } from "@/components/PageContainer";

// One flat page, no tab strip — Search, Create and Enrich are steps of one
// pipeline, not three tools to pick between.
//
// Not ConfigPageLayout: this page keeps its own wider `5xl` container and the
// extra bottom padding, because the search results table is wide and the page
// is now long enough that the last step wants room under it. Widening the
// shared shell would drag Sourcing and the other flat config pages with it.
export default function ManageMultipleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer size="5xl" className="pb-16 sm:pb-24">
      <PageHeader
        eyebrow="Manage · Places"
        title="Manage Multiple Places"
        description="Search Google for many places, create them, and enrich them — in that order."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
