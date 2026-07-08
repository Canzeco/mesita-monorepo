import { PageContainer, PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { MEMO_SUBROUTES } from "./nav";

// Memo Config — Mesita's consumer AI concierge (consumer-web-ask-memo). Mirrors
// the Atlas / Enricher Config shells: PageContainer + PageHeader + a tab strip,
// then the config sections.
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
      <ConfigTabNav ariaLabel="Memo Config" subroutes={MEMO_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
