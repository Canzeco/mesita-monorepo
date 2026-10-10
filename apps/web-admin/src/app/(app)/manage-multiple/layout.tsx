import { PageContainer, PageHeader } from "@/components/PageContainer";

// Manage › Multiple Places — one flat page: Google Search · Mesita Search ·
// Crenup, over a pasted list. The one-place sibling is Single Place
// (/manage-single), which runs the same actions on one place.
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
        eyebrow="Manage · Multiple Places"
        title="Multiple Places"
        description="Many places at once. Google Search and Mesita Search look them up. Crenup writes them — Create, Enrich, Update. The rail jumps to each; one place at a time is Single Place."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
