import {
  Close,
  Footer,
  Guests,
  Hero,
  How,
  Nav,
  Offers,
  Places,
  Pricing,
} from "@/components/landing";

// Landing page — landing.mesita.ai, written to 🦚 Main (MESITA-4991).
//
// Four guest solutions (Main § 3) and four restaurant solutions (Main § 4).
// Rows not live yet say Soon. The lists live in
// `components/landing/solutions.ts`.
//
// Composition stays flat: one function per section, top to bottom.
//
//   1. <Nav />      Sticky bar: four anchors, For restaurants, Open Mesita
//   2. <Hero />     The promise, one place card with a chip from each side
//   3. <Guests />   Four guest solutions, one card of rows       (#guests)
//   4. <Places />   Four restaurant solutions, one card of rows  (#restaurants)
//   5. <How />      Mesita never needs a place to sign up        (#how)
//   6. <Offers />   Paying ahead, one worked example and a table (#offers)
//   7. <Pricing />  What a restaurant pays, as a table           (#pricing)
//   8. <Close />    One door per side
//   9. <Footer />

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Guests />
      <Places />
      <How />
      <Offers />
      <Pricing />
      <Close />
      <Footer />
    </main>
  );
}
