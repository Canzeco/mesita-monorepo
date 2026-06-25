import { PageContainer, PageHeader } from "@/components/PageContainer";
import { AdeaTabs } from "./AdeaTabs";

export default function AtlasConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Venue enrichment"
        title="ADEA"
        description="ADEA builds and refreshes Mesita venue profiles. For each venue it finds source URLs, pulls content from Google, the web, and social channels, then writes the listing from everything it collected."
      />
      <AdeaTabs />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
