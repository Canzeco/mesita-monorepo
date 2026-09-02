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
      description="Mesita prices two contexts and only one of them shipped: a visit, where the guest is at the place and a ticket carries the discount, and an order, where they are not. This page is everything about an order except what it pays — channels, fulfilment, per-plan quotas and what makes one eligible. Rates live in Rewards Config, whose orders column is parked with it. There is no orders table, EF or consumer type yet, so there is nothing to configure and the page stays empty until one exists."
    >
      {children}
    </ConfigPageLayout>
  );
}
