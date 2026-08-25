import { PageContainer, PageHeader } from "@/components/PageContainer";

// One flat page, three boxes — Create, Enrich, Create + Enrich. Search is
// inside Create, not its own box.
//
// Not ConfigPageLayout: this page keeps its own wider `5xl` container and the
// extra bottom padding, because the search results table is wide and the page
// is long enough that the last box wants room under it.

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
        description="Create, Enrich, or Create + Enrich. The rail at the top jumps to each. Spend estimates live on Intake."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
