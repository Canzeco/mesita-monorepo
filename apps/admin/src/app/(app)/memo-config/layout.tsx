import { PageContainer, PageHeader } from "@/components/PageContainer";

// Memo Config — a single page (no sub-tabs). Mirrors the Atlas Config shell:
// PageContainer + PageHeader, then the config sections.
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
