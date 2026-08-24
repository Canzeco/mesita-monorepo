import {
  CapitalCredits,
  Close,
  DiscoveryEngines,
  Footer,
  Hero,
  Nav,
  OrderAgents,
  RewardsProgram,
  Positioning,
  Products,
  ReservationAgents,
  Revenue,
  Summary,
  SuperCatalog,
  ThreeSides,
} from "@/components/landing";

// Landing page — the evaluator-facing pitch surface for mesita.ai.
//
// The page IS the read: it assumes roughly ten minutes of attention and
// nothing else, so anything deeper sits behind the CTA rather than being a
// prerequisite. Written pre-launch (San Francisco, January 2027) — the status
// badge in the hero does the honesty work for every section below it, which
// is what lets the money system appear in product voice without ever
// claiming to be live.
//
// Composition stays flat: one function per section, top to bottom.
//
//   1.  <Nav />                 Sticky bar, anchors + CTA
//   2.  <Hero />                Status, promise, photo with UI chips
//   3.  <Summary />             The quotable paragraph, typographic
//   4.  <ThreeSides />          Guests · partners · everyone else (~100:1)
//   5.  <Products />            Consumer app · consumer MCP · business app
//   6.  <SuperCatalog />        The moat, with a card mid-enrichment
//   7.  <DiscoveryEngines />    Eight doors, one intelligence
//   8.  <ReservationAgents />   The wow: the agent phones the restaurant
//   9.  <OrderAgents />         The economics: 0% against 25–30%
//   10. <RewardsProgram />      Five rewards with reasons; Sharing dominates
//   11. <CapitalCredits />      The money system, the page's one dark act
//   12. <Revenue />             Three streams, three refusals
//   13. <Positioning />         Demand · software · capital
//   14. <Close />               Built-facts, status, dual CTA
//   15. <Footer />
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
      <Products />
      <SuperCatalog />
      <DiscoveryEngines />
      <ReservationAgents />
      <OrderAgents />
      <RewardsProgram />
      <CapitalCredits />
      <Revenue />
      <Positioning />
      <Close />
      <Footer />
    </main>
  );
}
