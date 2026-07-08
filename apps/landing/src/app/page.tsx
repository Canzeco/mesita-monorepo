import Image from "next/image";
import Link from "next/link";
import {
  Compass,
  CalendarCheck,
  Sparkles,
  TrendingUp,
  Instagram,
  BarChart3,
  Store,
  UserCircle,
  CheckCircle2,
  ArrowRight,
  QrCode,
  Receipt,
  BadgeCheck,
  ScanLine,
  CreditCard,
  MapPin,
  Users,
  MessageCircle,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Subdomain URLs — landing lives on mesita.ai, consumer + business are
// separate apps. Keep absolute so links work from any environment.
const CONSUMER_URL = "https://consumer.mesita.ai";
// Business auth lives at the subdomain root — `?mode=signup` lands the
// AuthTabs control on the Create account variant. Bare URL renders the
// default Sign in mode.
const BUSINESS_SIGNUP_URL = "https://business.mesita.ai/?mode=signup";
const BUSINESS_SIGNIN_URL = "https://business.mesita.ai/";

// Landing page — single-source-of-truth marketing surface.
//
// Spanglish edition (approved copy): key titles + subtitles in English,
// body copy in Spanish, product keywords kept in English (Discovery
// Intelligence, AI concierge, Verified, Premium, Welcome/Returning
// discount, QR, ROAS, agent). The current hero image is preserved.
//
// Composition stays intentionally flat: one function per section, top to
// bottom in page order.
//
//   1.  <Nav />                   Top menu bar
//   2.  <Hero />                  Headline + two-path CTA + product shot
//   3.  <ProofStrip />            "Every place in the city is already here"
//   4.  <HowItWorks />            Tonight, in three taps
//   5.  <DiscoveryIntelligence /> Every way to explore, one brain
//   6.  <AIReservations />        Never call a restaurant again
//   7.  <Rewards />               Pay less just for showing up
//   8.  <Premium />               Three doors into the top rates
//   9.  <ForBusinesses />         Flip side, dark surface
//   10. <FAQ />                   Six essentials, expandable
//   11. <FinalCTA />              Tonight's plan, solved
//   12. <Footer />               © Mesita 2026
//
// Pricing detail stays off the public site by design — the three-plan grid
// lives inside the business auth surface. The page sells the value prop.

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

// ─── 1. Top menu bar ─────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span aria-hidden className="text-xl">
            🌲
          </span>
          mesita
          <span className="text-primary">.</span>
        </Link>
        <nav className="text-muted-foreground hidden items-center gap-7 text-sm md:flex">
          <a href="#how" className="hover:text-foreground transition">
            How it works
          </a>
          <a href="#rewards" className="hover:text-foreground transition">
            Rewards
          </a>
          <a href="#premium" className="hover:text-foreground transition">
            Premium
          </a>
          <a href="#business" className="hover:text-foreground transition">
            For businesses
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden rounded-full sm:inline-flex"
          >
            <Link href={BUSINESS_SIGNUP_URL}>Tengo un lugar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href={CONSUMER_URL}>
              Get the app
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ─── 2. Hero ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 pt-16 pb-12 text-center md:pt-24 md:pb-20">
        <Badge
          variant="outline"
          className="bg-background/70 text-muted-foreground rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
        >
          Smart hospitality · Hecho en Monterrey
        </Badge>

        <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
          Where should we go tonight?
          <br />
          <span className="text-primary">Mesita lo sabe.</span>
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl">
          Todos los restaurantes, cafés, bares y antros de tu ciudad —
          matcheados a tu vibe, reservados por <strong>AI</strong> y más baratos
          solo por usar la app. Una sola app para los dos lados de la mesa.
        </p>

        {/* Two-path CTA: symmetric buttons for diners and places. Same shape,
            size, hover; only the color treatment differs so the eye can tell
            them apart. Both routes live on production subdomains. */}
        <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <PathButton
            href={CONSUMER_URL}
            Icon={UserCircle}
            eyebrow="Salgo esta noche"
            label="Get the app"
            variant="primary"
          />
          <PathButton
            href={BUSINESS_SIGNUP_URL}
            Icon={Store}
            eyebrow="Tengo un negocio"
            label="Tengo un lugar"
            variant="dark"
          />
        </div>

        <p className="text-muted-foreground text-xs">
          Gratis para diners · Set up en 10 minutos · Un descuento en cada
          visita
        </p>

        <figure className="border-border shadow-elev mt-8 w-full overflow-hidden rounded-3xl border md:mt-12">
          <Image
            src="/landing-hero.jpg"
            alt="Tacos y una bebida de Mesita en un rooftop con el skyline de Monterrey detrás"
            width={1540}
            height={1021}
            priority
            sizes="(max-width: 1024px) 100vw, 1100px"
            className="h-auto w-full"
          />
        </figure>
      </div>
    </section>
  );
}

function PathButton({
  href,
  Icon,
  eyebrow,
  label,
  variant,
}: {
  href: string;
  Icon: typeof UserCircle;
  eyebrow: string;
  label: string;
  variant: "primary" | "dark";
}) {
  const className =
    variant === "primary"
      ? "bg-pink-gradient shadow-glow text-white"
      : "bg-foreground text-background";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-full px-5 py-4 text-left transition hover:opacity-90 ${className}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] tracking-[0.18em] uppercase opacity-80">
          {eyebrow}
        </span>
        <span className="text-[15px] font-semibold">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ─── 3. Proof strip ──────────────────────────────────────────────────────
// The differentiator, stated up front: the catalog is already complete, so
// diners never hit an empty app and places don't "join" — they upgrade a
// profile that already exists.

function ProofStrip() {
  const points: { stat: string; label: string }[] = [
    { stat: "Every place", label: "de la ciudad, ya adentro" },
    { stat: "AI bookings", label: "en todos los lugares" },
    { stat: "Hasta 70%", label: "de descuento en lugares Verified" },
  ];
  return (
    <section className="border-border bg-background border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 md:py-14">
        <p className="text-muted-foreground mx-auto max-w-2xl text-center text-sm md:text-base">
          Mesita arranca llena. Cada restaurante, café, bar y antro está
          auto-sourced y enriquecido por <strong>AI</strong> — fotos, menús,
          horarios, vibe — así que un lugar no{" "}
          <span className="text-foreground font-medium">se une a Mesita</span>,
          sino que{" "}
          <span className="text-foreground font-medium">
            mejora el perfil que ya tiene
          </span>
          .
        </p>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {points.map((p) => (
            <div
              key={p.stat}
              className="border-border bg-card flex flex-col items-center gap-1 rounded-2xl border px-4 py-5 text-center"
            >
              <span className="font-display text-primary text-2xl font-semibold tracking-tight">
                {p.stat}
              </span>
              <span className="text-muted-foreground text-xs leading-snug">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. How it works ─────────────────────────────────────────────────────

function HowItWorks() {
  const steps: {
    n: string;
    title: string;
    body: string;
    Icon: typeof Compass;
  }[] = [
    {
      n: "1",
      title: "Discover",
      body: "Swipea los mejores matches de hoy, explora el mapa en vivo o pregúntale a la AI: “rooftop para date hoy, no tan caro”.",
      Icon: Compass,
    },
    {
      n: "2",
      title: "Book",
      body: "Elige hora y personas. Nuestro agent llama, manda DM o correo al lugar y te confirma la mesa en minutos.",
      Icon: CalendarCheck,
    },
    {
      n: "3",
      title: "Pay less",
      body: "En la mesa, el staff escanea tu QR y el descuento se aplica directo a la cuenta. Le pagas al lugar como siempre.",
      Icon: CreditCard,
    },
  ];
  return (
    <section id="how" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="How it works"
          title="Tonight, in three taps."
          aside="Descubre, reserva y paga menos — sin puntos que juntar y sin letras chiquitas."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.Icon;
            return (
              <article
                key={s.n}
                className="border-border bg-background relative flex flex-col gap-3 rounded-2xl border p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-muted-foreground/40 text-4xl font-semibold">
                    {s.n}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {s.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── 5. Discovery Intelligence ───────────────────────────────────────────

function DiscoveryIntelligence() {
  const items: { title: string; body: string; Icon: typeof Compass }[] = [
    {
      title: "Swipe",
      body: "El deck de la noche: los matches de hoy, uno por uno, ordenados por lo que te late.",
      Icon: Sparkles,
    },
    {
      title: "Live map",
      body: "Todo el catálogo en un mapa en vivo — busca por zona, categoría o lo que se te antoje.",
      Icon: MapPin,
    },
    {
      title: "Social",
      body: "Sigue dónde andan tus amigos y los Premium ahora mismo, en tiempo real.",
      Icon: Users,
    },
    {
      title: "AI concierge",
      body: "Pregúntale con tus palabras y te rankea cada lugar por vibe, zona, presupuesto y lo que está pasando en vivo.",
      Icon: MessageCircle,
    },
  ];
  return (
    <section id="discovery" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Discovery Intelligence"
          title="Every way to explore, one brain."
          aside="Swipea, busca en el mapa, sigue a tu gente o pregúntale al AI concierge — una misma inteligencia detrás de todo."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((it) => (
            <FeatureCard
              key={it.title}
              {...it}
              iconClass="bg-primary/10 text-primary"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 6. AI Reservations ──────────────────────────────────────────────────

function AIReservations() {
  return (
    <section id="reservations" className="border-border border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-24">
        <div className="flex flex-col gap-5">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            AI Reservations
          </p>
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
            Never call a restaurant again.
          </h2>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
            Pon hora y personas — el <strong>agent</strong> de Mesita reserva
            por teléfono, WhatsApp, Instagram o correo, por donde el lugar
            conteste. Funciona en <strong>todos</strong> los lugares de la
            ciudad, no solo los partners. Confirmación al instante, ticket en la
            app.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Voice", "WhatsApp", "Instagram DM", "Email", "Web form"].map(
              (ch) => (
                <span
                  key={ch}
                  className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  <CheckCircle2 className="text-secondary h-3.5 w-3.5" />
                  {ch}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="border-border bg-hero shadow-elev flex flex-col gap-4 rounded-3xl border p-8">
          <span className="bg-pink-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-white">
            <CalendarCheck className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-semibold tracking-tight">
            “Mesa para 4, viernes 9pm.”
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            El agent contacta al lugar, negocia el horario y te avisa cuando
            está confirmada. Tú no marcas, no esperas en línea, no mandas DMs.
          </p>
          <span className="text-whatsapp inline-flex items-center gap-2 text-sm font-medium">
            <BadgeCheck className="h-4 w-4" />
            Confirmado en minutos
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── 7. Rewards ──────────────────────────────────────────────────────────

function Rewards() {
  const steps: {
    n: string;
    title: string;
    body: string;
    Icon: typeof QrCode;
  }[] = [
    {
      n: "1",
      title: "Scan your QR",
      body: "El staff escanea el QR de tu tarjeta Mesita. Nada que instalar para ellos — corre sobre WhatsApp o web.",
      Icon: QrCode,
    },
    {
      n: "2",
      title: "They enter the bill",
      body: "Mesita aplica tu descuento — 10–70% — al momento y muestra el nuevo total a ti y al staff.",
      Icon: Receipt,
    },
    {
      n: "3",
      title: "You pay less, directly",
      body: "Le pagas al lugar por cualquier método, efectivo o tarjeta. Mesita nunca toca tu dinero — sin settlement, sin esperas.",
      Icon: CreditCard,
    },
  ];
  return (
    <section id="rewards" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Rewards"
          title="Pay less just for showing up."
          aside="Los lugares Verified te dan un Welcome discount en tu primera visita y un Returning discount en cada visita después — directo a la cuenta."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.Icon;
            return (
              <article
                key={s.n}
                className="border-border bg-background relative flex flex-col gap-3 rounded-2xl border p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-muted-foreground/40 text-4xl font-semibold">
                    {s.n}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {s.body}
                </p>
              </article>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-8 inline-flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="text-secondary h-4 w-4" />
          Sin cashback, sin wallet, sin invoice. El descuento es el gasto de
          marketing del propio lugar, aplicado en su propia cuenta.
        </p>
      </div>
    </section>
  );
}

// ─── 8. Premium ──────────────────────────────────────────────────────────

function Premium() {
  const doors: { title: string; body: string; Icon: typeof Instagram }[] = [
    {
      title: "Instagram",
      body: "Gratis. Verifica una cuenta con 1K+ followers y sube una story taggeando el lugar para liberar cada reward.",
      Icon: Instagram,
    },
    {
      title: "Subscription",
      body: "$100 MXN / mes vía Stripe. Los mejores rates en todos lados, sin story, nunca.",
      Icon: BadgeCheck,
    },
    {
      title: "Invitation",
      body: "Para la gente que hace la noche: chefs, models, creators, prensa y founders — los guests que los lugares quieren en la sala.",
      Icon: Sparkles,
    },
  ];
  return (
    <section id="premium" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Premium"
          title="Premium unlocks the top rates. Three doors in."
          aside="Todos empiezan Free — discovery completo, AI reservations y un descuento en cada lugar Verified. Premium sube los rates en todos lados."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {doors.map((d) => {
            const Icon = d.Icon;
            return (
              <article
                key={d.title}
                className="border-border bg-background flex flex-col gap-3 rounded-2xl border p-6"
              >
                <span className="bg-secondary/10 text-secondary flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {d.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {d.body}
                </p>
              </article>
            );
          })}
        </div>
        <SectionFooter
          note="Free para siempre. Premium se gana gratis con Instagram, o $100 MXN / mes."
          cta={{ href: CONSUMER_URL, label: "Get the app" }}
          variant="primary"
        />
      </div>
    </section>
  );
}

// ─── 9. For businesses (flip side, dark) ─────────────────────────────────

function ForBusinesses() {
  const items: { title: string; body: string; Icon: typeof TrendingUp }[] = [
    {
      title: "Be found first",
      body: "Placement prioritario justo en el momento en que la gente decide a dónde ir. El Welcome discount convierte esa visibilidad en primeras visitas.",
      Icon: TrendingUp,
    },
    {
      title: "Fill the room with the right crowd",
      body: "Configura rates distintos para Free y Premium, y atrae a los guests que traen reach o consumo — no a todos por igual.",
      Icon: Target,
    },
    {
      title: "Guaranteed Instagram reach",
      body: "Los rewards con story se verifican antes de liberar el descuento — auto para cuentas públicas, screenshot + un tap del staff para privadas. Primero la exposure, siempre.",
      Icon: Instagram,
    },
    {
      title: "Reservations with nothing to install",
      body: "Nuestro agent reserva por los canales que ya usas — teléfono, WhatsApp, Instagram, correo. Ves party size y class antes de la visita.",
      Icon: CalendarCheck,
    },
    {
      title: "Proof, not promises",
      body: "Un solo dashboard: funnel completo (views → swipes → rewards → visits → stories), gasto influenciado, repeat rate y ROAS, con un AI copilot que te arma la próxima promo.",
      Icon: BarChart3,
    },
  ];
  return (
    <section
      id="business"
      className="bg-foreground text-background border-border border-b"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-background/60 text-xs font-medium tracking-[0.18em] uppercase">
              For businesses
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Own a place? Your customers are already here.
            </h2>
          </div>
          <p className="text-background/70 max-w-sm text-sm">
            Tu perfil ya está en Mesita. Reclámalo y convierte visibilidad en
            visitas — sin hardware, sin setup.
          </p>
        </header>

        <ListedVsVerifiedDark />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const Icon = it.Icon;
            return (
              <article
                key={it.title}
                className="border-background/15 bg-background/5 flex flex-col gap-3 rounded-2xl border p-6"
              >
                <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {it.title}
                </h3>
                <p className="text-background/70 text-sm leading-relaxed">
                  {it.body}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-background/70 inline-flex items-center gap-2 text-[13px]">
            <CheckCircle2 className="h-4 w-4" />
            Free (listado) · Pro $100 MXN/mes · Ultra $5,000 MXN/mes — la misma
            mecánica, más visibilidad.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-background text-foreground hover:bg-background rounded-full hover:opacity-90"
          >
            <Link href={BUSINESS_SIGNUP_URL}>
              Claim your place
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// Compact two-up explainer, dark variant: what a place gets before vs. after
// it claims its profile.
function ListedVsVerifiedDark() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="border-background/20 bg-background/5 rounded-2xl border border-dashed p-6">
        <div className="flex items-center gap-2">
          <ScanLine className="text-background/60 h-4 w-4" />
          <h3 className="font-display text-base font-semibold tracking-tight">
            Listed
          </h3>
          <Badge
            variant="outline"
            className="border-background/30 text-background/60 ml-auto rounded-full text-[10px]"
          >
            Auto-sourced
          </Badge>
        </div>
        <p className="text-background/70 mt-3 text-[13px] leading-relaxed">
          Armado para ti desde datos públicos — discoverable y AI-bookable, sin
          costo y sin sign-up. Sin rewards, sin dashboard.
        </p>
      </div>
      <div className="border-primary/50 bg-background/10 rounded-2xl border p-6">
        <div className="flex items-center gap-2">
          <BadgeCheck className="text-primary h-4 w-4" />
          <h3 className="font-display text-base font-semibold tracking-tight">
            Verified
          </h3>
          <Badge className="bg-pink-gradient ml-auto rounded-full border-0 text-[10px] text-white">
            Tú lo reclamas
          </Badge>
        </div>
        <p className="text-background/70 mt-3 text-[13px] leading-relaxed">
          Reclama tu perfil para correr rewards, configurar descuentos por class
          y story bonuses, ganar priority placement y abrir el dashboard
          completo.
        </p>
      </div>
    </div>
  );
}

// ─── 10. FAQ ─────────────────────────────────────────────────────────────

function FAQ() {
  const items: { q: string; a: string }[] = [
    {
      q: "¿Mesita es gratis?",
      a: "Sí. Descubre, reserva y consigue descuentos sin pagar nada. Premium sube los rates en todos lados y se gana gratis con Instagram, o cuesta $100 MXN / mes.",
    },
    {
      q: "¿Cómo uso un descuento?",
      a: "Muestras tu QR, el staff lo escanea y el descuento se aplica directo a tu cuenta — 10–70% en lugares Verified. Le pagas al lugar por cualquier método, efectivo o tarjeta. Mesita nunca toca tu dinero.",
    },
    {
      q: "¿Tengo que subir una story?",
      a: "Solo si tu Premium viene por la puerta de Instagram: subes una story taggeando el lugar para liberar el reward. Mesita la auto-verifica para cuentas públicas; las privadas mandan screenshot que un staff confirma. Suscriptores e invitados nunca suben nada.",
    },
    {
      q: "¿Puedo reservar en cualquier lugar?",
      a: "Sí — el AI agent reserva en todos los lugares de la ciudad, no solo los Verified. Pon hora y personas y contacta al lugar por teléfono, WhatsApp, Instagram o correo, por donde conteste.",
    },
    {
      q: "Tengo un lugar — ¿cuánto cuesta?",
      a: "Seguramente ya estás listado gratis. Los planes de paga (Pro $100 MXN/mes · Ultra $5,000 MXN/mes) compran visibilidad; tú defines y fondeas tus propios descuentos, y Mesita nunca toca el pago. Setup en 10 minutos, sin hardware ni POS.",
    },
    {
      q: "¿Mesita mueve o guarda dinero?",
      a: "Nunca. Mesita es un producto de suscripción, no un marketplace — sin cashback, sin wallet, sin settlement. El descuento es el gasto de marketing del propio lugar, aplicado en su propia cuenta, y el diner le paga al lugar directo.",
    },
  ];
  return (
    <section id="faq" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Frequently asked
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          Lo esencial, para diners y dueños de lugares por igual.
        </p>
        <div className="divide-border border-border bg-background mt-8 divide-y rounded-2xl border">
          {items.map((it) => (
            <details
              key={it.q}
              className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm leading-snug font-semibold">
                {it.q}
                <span
                  aria-hidden
                  className="text-muted-foreground text-base transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 11. Final CTA ───────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-hero border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center md:py-24">
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Tonight&apos;s plan, solved.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base">
          Los diners descubren y ahorran. Los lugares llenan la sala con los
          guests que importan. Escoge tu lado.
        </p>
        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <PathButton
            href={CONSUMER_URL}
            Icon={UserCircle}
            eyebrow="Salgo esta noche"
            label="Get the app"
            variant="primary"
          />
          <PathButton
            href={BUSINESS_SIGNUP_URL}
            Icon={Store}
            eyebrow="Tengo un negocio"
            label="Tengo un lugar"
            variant="dark"
          />
        </div>
      </div>
    </section>
  );
}

// ─── 12. Footer ──────────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="font-display flex items-center gap-2 text-base font-semibold tracking-tight">
          <span aria-hidden className="text-lg">
            🌲
          </span>
          mesita<span className="text-primary">.</span>
        </div>
        <p className="text-muted-foreground text-[12px]">
          © Mesita · {year} · Smart hospitality since 2026 · Hecho en Monterrey
        </p>
        <nav className="text-muted-foreground flex flex-wrap items-center gap-4 text-[12px]">
          <a href="#how" className="hover:text-foreground transition">
            How it works
          </a>
          <a href="#rewards" className="hover:text-foreground transition">
            Rewards
          </a>
          <a href="#business" className="hover:text-foreground transition">
            For businesses
          </a>
          <Link
            href={BUSINESS_SIGNIN_URL}
            className="hover:text-foreground transition"
          >
            Business sign-in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

// ─── Shared pieces ───────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside: string;
}) {
  return (
    <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
      </div>
      <p className="text-muted-foreground max-w-sm text-sm">{aside}</p>
    </header>
  );
}

function FeatureCard({
  title,
  body,
  Icon,
  iconClass,
}: {
  title: string;
  body: string;
  Icon: typeof Compass;
  iconClass: string;
}) {
  return (
    <article className="border-border bg-background flex flex-col gap-3 rounded-2xl border p-6">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
    </article>
  );
}

function SectionFooter({
  note,
  cta,
  variant,
}: {
  note: string;
  cta: { href: string; label: string };
  variant: "primary" | "dark";
}) {
  const btnClass =
    variant === "primary"
      ? "bg-pink-gradient shadow-glow rounded-full text-white hover:opacity-90"
      : "bg-foreground text-background hover:bg-foreground rounded-full hover:opacity-90";
  return (
    <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground inline-flex items-center gap-2 text-[13px]">
        <CheckCircle2 className="text-secondary h-4 w-4" />
        {note}
      </p>
      <Button asChild size="lg" className={btnClass}>
        <Link href={cta.href}>
          {cta.label}
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
