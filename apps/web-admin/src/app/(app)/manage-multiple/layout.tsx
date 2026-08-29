import { PageContainer, PageHeader } from "@/components/PageContainer";

// One flat page: Google Search · Mesita Search · Mesita Intake.
// Create, Enrich, Update, and Create + Enrich share the Intake box.

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
        description="Google Search · Mesita Search · Mesita Intake. Create, Enrich, and Update share Intake. The rail jumps to each."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
