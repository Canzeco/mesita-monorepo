import { PageContainer, PageHeader } from "@/components/PageContainer";

// Sourcing Config — a single flat page (no sub-tabs). Governs which Google Places
// are eligible to enter Mesita, per sourcing channel (admin add/search, business
// add, consumer add, Memo search), with a per-channel Google quality bar.
export default function SourcingConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations · Sourcing"
        title="Sourcing Config"
        description="Which places are allowed into Mesita, and who can add them. Each sourcing channel picks the eligible place families and a Google quality bar (min rating + reviews). Places sourced from Google Places must land in an enabled family and clear the floors — that's how schools, hospitals and shops stay out."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
