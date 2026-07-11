import { PageContainer, PageHeader } from "@/components/PageContainer";

export default function Home() {
  return (
    <PageContainer size="3xl">
      <PageHeader
        eyebrow="Overview"
        title="Mesita Admin"
        description="Pick an action from the sidebar."
      />
    </PageContainer>
  );
}
