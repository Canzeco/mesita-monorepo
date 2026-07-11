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
        description="Which places are allowed into Mesita, who can see them, and who can add them. Per actor there are two filters: search (what's visible in the searchbar — including Google places not yet in Mesita) and add (what may actually be onboarded). Each picks the eligible place families and a Google quality bar (min rating + reviews); a place must land in an enabled family and clear the floors — that's how schools, hospitals and shops never even show up."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
