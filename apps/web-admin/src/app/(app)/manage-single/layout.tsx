import { PageContainer, PageHeader } from "@/components/PageContainer";

// Manage › Single Place — one place: find it, read it, Crenup it, and step
// through to its editor in the business console. The bulk sibling is
// Multiple Places; this page runs the same server actions on one place.

export default function ManageSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer size="5xl" className="pb-16 sm:pb-24">
      <PageHeader
        eyebrow="Manage · Single Place"
        title="Single Place"
        description="One place at a time. A Google Place ID or a name finds it — on Mesita and on Google, and a place Mesita lacks is added from the list; the facts and the Crenup ladder read it; Create, Enrich, List, Unlist and Delete write it. Everything else is edited in the business console."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
