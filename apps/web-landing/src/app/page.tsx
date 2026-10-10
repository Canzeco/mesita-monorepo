import {
  Close,
  Discovery,
  Footer,
  Hero,
  Nav,
  PrepaidCredits,
  ReservationAgents,
  RewardsProgram,
} from "@/components/landing";

// Landing page — the guest-facing pitch for mesita.ai.
//
// FOUR PRODUCTS, ALL OF THEM LIVE. Pato cut the page to what a guest can use
// today (2026-09-28): the earlier fifteen-section evaluator read carried the
// restaurant side, the order economics, the money system and three income
// streams, and none of it is what a guest opens the app for. What stays is
// the loop a visit actually runs — find the place, book it, prepay it, get
// rewarded at the table — in that order, and nothing that is not built.
//
// The status badge in the hero still does the honesty work for the page: it
// is pre-launch in its market, so every section speaks in product voice
// without claiming liveness where it is.
//
// Composition stays flat: one function per section, top to bottom.
//
//   1. <Nav />                Sticky bar, four anchors + CTA
//   2. <Hero />               Promise, photo with UI chips
//   3. <Discovery />          Citywide Discovery: the self-building catalog
//   4. <ReservationAgents />  Reservations Agent: the agent phones the place
//   5. <PrepaidCredits />     Prepaid Credits: pay 100, spend 110
//   6. <RewardsProgram />     Visit Rewards: four action rewards
//   7. <Close />              The four names, status, dual CTA
//   8. <Footer />
//
// The numbers on the page are the ones Pato dictated for it: 30 US cents a
// profile, 1,000 places in ten minutes, 100 → 110 on Credits.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Discovery />
      <ReservationAgents />
      <PrepaidCredits />
      <RewardsProgram />
      <Close />
      <Footer />
    </main>
  );
}
