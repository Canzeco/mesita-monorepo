import { PageContainer, PageHeader } from "@/components/PageContainer";

// One flat page: Google Search · Mesita Search · Mesita Intake, then Edit.
// Not ConfigPageLayout: this page keeps its own wider `5xl` container and
// the extra bottom padding, because result tables are wide and the last
// control wants room under it.

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
        description="Google Search, Mesita Search, Mesita Intake, then Edit. The rail jumps to each. Spend estimates live on Intake."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
