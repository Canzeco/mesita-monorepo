import {
  AIReservations,
  DiscoveryIntelligence,
  FAQ,
  FinalCTA,
  Footer,
  ForBusinesses,
  Hero,
  HowItWorks,
  Nav,
  Premium,
  ProofStrip,
  Rewards,
} from "@/components/landing";

// Landing page — single-source-of-truth marketing surface.
//
// Spanish edition: natural Mexican Spanish throughout, with only a light
// touch of English for genuine brand terms (Premium). The current hero
// image is preserved. Renders at the site root (mesita.ai/).
//
// Composition stays intentionally flat: one function per section, top to
// bottom in page order.
//
//   1.  <Nav />                   Barra superior
//   2.  <Hero />                  Titular + doble CTA + foto del producto
//   3.  <ProofStrip />            "Toda la ciudad ya está adentro"
//   4.  <HowItWorks />            Tu plan de hoy, en tres pasos
//   5.  <DiscoveryIntelligence /> Muchas formas de explorar
//   6.  <AIReservations />        Nunca vuelvas a llamar a un restaurante
//   7.  <Rewards />               Paga menos solo por ir
//   8.  <Premium />               Tres formas de entrar a Premium
//   9.  <ForBusinesses />         El otro lado, superficie oscura
//   10. <FAQ />                   Lo esencial, expandible
//   11. <FinalCTA />              Tu plan de hoy, resuelto
//   12. <Footer />               © Mesita 2026
//
// Los precios detallados quedan fuera del sitio público por diseño — la
// tabla de planes vive dentro de la consola de negocios.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <ProofStrip />
      <HowItWorks />
      <DiscoveryIntelligence />
      <AIReservations />
      <Rewards />
      <Premium />
      <ForBusinesses />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
