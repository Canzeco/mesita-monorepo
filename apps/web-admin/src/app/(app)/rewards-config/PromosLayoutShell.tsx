import { PageHeader } from "@/components/PageContainer";

// Rewards Config — one page, no tab strip. Description is one line; stacking
// math lives behind a disclosure on the visit boxes.

export function PromosLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Product · Rewards"
        title="Rewards Config"
        description="Visit rewards only — not orders, not prepaid. One page. Three boxes."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
