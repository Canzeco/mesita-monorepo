import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Orders Config — the remote context's policy. One flat page.
export default function OrdersConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Product · Orders"
      title="Orders Config"
      description="Mesita prices two contexts and only one of them shipped: a visit, where the guest is at the place and a ticket carries the discount, and an order, where they are not. There is no orders table, EF or consumer type yet, so this page carries no knobs at all — it is Soon, not a wall of staged switches. What an order will be lives in Notion Docs › Orders; what it will pay lives in Promos Config, whose orders column is parked alongside it."
    >
      {children}
    </ConfigPageLayout>
  );
}
