import { PageContainer, PageHeader } from "@/components/PageContainer";

// Buzz Config — a single flat page (no sub-tabs).
export default function BuzzConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        title="Buzz Config"
        description="Configuration surface for Buzz. Settings land here as the feature takes shape."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
