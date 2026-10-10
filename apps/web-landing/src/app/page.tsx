import {
  Close,
  Discovery,
  Footer,
  Hero,
  Nav,
  ReservationAgents,
} from "@/components/landing";

// Landing page — the guest-facing pitch for mesita.ai.
//
// THE THREE FIRST STAGE PRODUCTS: Citywide Catalog · Discovery Engines ·
// Reservations Agent (MESITA-2092). The MVP sells finding a place and booking
// it, and nothing else: prepaying, rewards and everything on the restaurant
// side are Second Stage and are not on this page.
//
// The status badge in the hero still does the honesty work for the page: it
// is pre-launch in its market, so every section speaks in product voice
// without claiming liveness where it is.
//
// Composition stays flat: one function per section, top to bottom.
//
//   1. <Nav />                Sticky bar, three anchors + CTA
//   2. <Hero />               Promise, photo with UI chips
//   3. <Discovery />          Citywide Catalog + Discovery Engines, one section
//   4. <ReservationAgents />  Reservations Agent: the agent phones the place
//   5. <Close />              The three names, status, dual CTA
//   6. <Footer />
//
// The numbers on the page are the ones Pato dictated for it: 30 US cents a
// profile, 1,000 places in ten minutes.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Discovery />
      <ReservationAgents />
      <Close />
      <Footer />
    </main>
  );
}
