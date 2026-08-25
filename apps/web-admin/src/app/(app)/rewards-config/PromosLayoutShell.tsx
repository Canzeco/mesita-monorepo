import { PageHeader } from "@/components/PageContainer";

// Promos Config — one page, no tab strip. Description is one line; stacking
// math lives behind a disclosure on the visit boxes.

export function PromosLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Product · Promos"
        title="Promos Config"
        description="Visit rewards only — not orders, not prepaid. Components that build every visit rate. A place picks one strategy — its column is the whole program."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
