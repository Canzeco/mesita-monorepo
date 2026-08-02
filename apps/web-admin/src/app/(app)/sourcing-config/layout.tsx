import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Sourcing Config — a single flat page (no sub-tabs). Governs which Google
// Places are eligible to enter Mesita, per sourcing channel.
export default function SourcingConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Sourcing"
      title="Sourcing Config"
      description="Which places are allowed into Mesita, who can see them, and who can add them. Per actor there are two filters: search (what's visible in the searchbar — including Google places not yet in Mesita) and add (what may actually be onboarded). Each picks the eligible place families and a Google quality bar (min rating + reviews)."
    >
      {children}
    </ConfigPageLayout>
  );
}
