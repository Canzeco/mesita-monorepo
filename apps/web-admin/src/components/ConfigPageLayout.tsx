import { PageContainer, PageHeader } from "@/components/PageContainer";

// Shared chrome for the flat (no-sub-tab) admin config sections — Atlas, Buzz,
// Memo, Sourcing. A page container, a header, and the section body below it.
// Sections that own sub-tabs (e.g. Enricher) compose their own shell instead.
export function ConfigPageLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
