import { PageContainer, PageHeader } from "@/components/PageContainer";

// Memo Config — a single flat page (no sub-tabs). Memo is Mesita's consumer AI
// concierge (consumer-web-ask-memo); this page tunes its persona, model, and
// place-retrieval knobs.
export default function MemoConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        title="Memo Config"
        description="Memo — Mesita's consumer AI concierge (consumer-web-ask-memo). Tune its persona, model, and how it retrieves places."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
