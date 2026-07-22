import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Reservations Config — a single flat page (no sub-tabs). Tunes the Reservationist
// agent: the number it calls (test override), how hard it retries, and which
// contact channel it books through (products.reservations).
export default function ReservationsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Reservations"
      title="Reservations Config"
      description="Mesita books tables with the Reservationist — a voice agent a Supabase function briefs and sends to phone the venue on a guest's behalf. This page tunes it: a test number to dial instead of real businesses while we're testing, how many times it retries, and the channel it books through. Today every place is booked by phone; WhatsApp and Instagram are held for verified partners and switched on from the business console."
    >
      {children}
    </ConfigPageLayout>
  );
}
