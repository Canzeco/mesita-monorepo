import { PageContainer, PageHeader } from "@/components/PageContainer";

export default function CreateUnitPage() {
  return (
    <PageContainer size="3xl">
      <PageHeader
        eyebrow="Units · Single"
        title="Manually create unit"
        description="Add a single place by hand. The Google Places picker plus the enrichment pass (Firecrawl + OpenAI) land here next."
      />
    </PageContainer>
  );
}
