import { PageContainer, PageHeader } from "@/components/PageContainer";

// Shared chrome for flat (no-sub-tab) admin config sections. A page
// container, a header, and the section body below it. Tabbed config
// (Promos) composes PageContainer + ConfigTabNav instead.
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
