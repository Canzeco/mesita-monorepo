import { PageContainer, PageHeader } from "@/components/PageContainer";

// One flat page: Google Search · Mesita Search · Crenup.
//
// CRENUP = CReate + ENrich + UPdate (decision: Pato, MESITA-2026). It replaces
// "Intake", which named the umbrella over those three verbs and so named
// nothing of its own. Two boxes read; Crenup is the one that writes.

export default function ManageMultipleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer size="5xl" className="pb-16 sm:pb-24">
      <PageHeader
        eyebrow="Manage · Places"
        title="Manage Places"
        description="Google Search and Mesita Search look places up. Crenup writes them — Create, Enrich, Update. The rail jumps to each."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
