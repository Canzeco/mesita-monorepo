import { PageContainer, PageHeader } from "@/components/PageContainer";

// Shared chrome for flat (no-sub-tab) admin config sections, Discovery
// included since MESITA-2327: a page container, a header, and the section
// body below it.
export function ConfigPageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
