import {
  CapitalCredits,
  Close,
  DiscoveryEngines,
  Footer,
  Hero,
  Nav,
  OrderAgents,
  PassportRewards,
  Positioning,
  ReservationAgents,
  Revenue,
  Summary,
  SuperCatalog,
  ThreeSides,
} from "@/components/landing";

// Landing page — the evaluator-facing pitch surface for mesita.ai.
//
// The page IS the read: it assumes roughly ten minutes of attention and
// nothing else, so the full project overview is the CTA rather than the
// prerequisite. Written pre-launch (San Francisco, January 2027) — the status
// badge in the hero does the honesty work for every section below it, which
// is what lets the money system appear in product voice without ever
// claiming to be live.
//
// Composition stays flat: one function per section, top to bottom.
//
//   1.  <Nav />                 Sticky bar, anchors + overview CTA
//   2.  <Hero />                Status, promise, photo with UI chips
//   3.  <Summary />             The quotable paragraph, typographic
//   4.  <ThreeSides />          Guests · partners · everyone else (~100:1)
//   5.  <SuperCatalog />        The moat, with a card mid-enrichment
//   6.  <DiscoveryEngines />    Eight doors, one intelligence
//   7.  <ReservationAgents />   The wow: the agent phones the restaurant
//   8.  <OrderAgents />         The economics: 0% against 25–30%
//   9.  <PassportRewards />     Identity is what partners buy
//   10. <CapitalCredits />      The money system, the page's one dark act
//   11. <Revenue />             Three streams, three refusals
//   12. <Positioning />         Demand · software · capital
//   13. <Close />               Built-facts, status, dual CTA
//   14. <Footer />
//
// Every number on the page is structural (100:1, 0% vs 25–30%, 100 → 110,
// ~2:1). Currency figures stay off the public site by design.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Summary />
      <ThreeSides />
      <SuperCatalog />
      <DiscoveryEngines />
      <ReservationAgents />
      <OrderAgents />
      <PassportRewards />
      <CapitalCredits />
      <Revenue />
      <Positioning />
      <Close />
      <Footer />
    </main>
  );
}
