import {
  Close,
  Footer,
  Guests,
  Hero,
  Modules,
  Nav,
  Offers,
  Places,
  Pricing,
} from "@/components/landing";

// Landing page — landing.mesita.ai. It says what 🦚 Main says, section by
// section, and nothing says Soon (MESITA-4994). The copy lives in
// `components/landing/solutions.ts`, `offers.tsx` and `pricing.tsx`.
//
//   1. <Nav />      Five anchors, Open Mesita, Claim your place (leads)
//   2. <Hero />     Main § 2, Mesita Summary
//   3. <Guests />   Main § 3, Consumer Solutions             (#guests)
//   4. <Places />   Main § 4, Restaurant Solutions           (#restaurants)
//   5. <Modules />  Main § 5, Restaurant Modules             (#modules)
//   6. <Offers />   Main § 7, Voucher Offers                 (#offers)
//   7. <Pricing />  Main § 8, what Mesita costs              (#pricing)
//   8. <Close />    One door per side, restaurants first
//   9. <Footer />

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Guests />
      <Places />
      <Modules />
      <Offers />
      <Pricing />
      <Close />
      <Footer />
    </main>
  );
}
