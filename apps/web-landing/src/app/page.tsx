import {
  Close,
  Footer,
  Guests,
  Hero,
  How,
  Nav,
  Places,
} from "@/components/landing";

// Landing page — mesita.ai, written to 🦚 Main (MESITA-3106).
//
// Main's eleven product solutions, and no more: six for the guest, five for
// the place. The three money products (Digital Payments, Credit Prepayments,
// Credit Rewards) are on both sides and not built yet, so their rows say
// Soon. The list itself lives in `components/landing/solutions.ts`.
//
// Composition stays flat: one function per section, top to bottom.
//
//   1. <Nav />     Sticky bar: three anchors, For places, Open Mesita
//   2. <Hero />    The promise, one place card with a chip from each side
//   3. <Guests />  Six guest products, one card of rows   (#guests)
//   4. <How />     Mesita never needs a place to sign up  (#how)
//   5. <Places />  Five place products, one card of rows  (#places)
//   6. <Close />   One door per side
//   7. <Footer />

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Guests />
      <How />
      <Places />
      <Close />
      <Footer />
    </main>
  );
}
