import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Reservations Config — a single flat page (no sub-tabs). Governs how the
// Enricher picks each place's one reservation endpoint (products.reservations).
export default function ReservationsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Reservations"
      title="Reservations Config"
      description="Every place gets exactly one reservation endpoint — the address the Reservationist books through. This page is how it's chosen. The Enricher walks the priority below top to bottom and takes the first channel the place actually has a contact for, so the order is the product rule: rank the channel you most want a booking to arrive on first. Parking a channel drops it from the running entirely — a place whose only contact is parked ends up with no endpoint at all."
    >
      {children}
    </ConfigPageLayout>
  );
}
