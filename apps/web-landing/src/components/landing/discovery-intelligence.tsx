import {
  type LucideIcon,
  MapPin,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { FeatureCard } from "@/components/landing/feature-card";
import { SectionHeader } from "@/components/landing/section-header";

function DiscoveryIntelligence() {
  const items: { title: string; body: string; Icon: LucideIcon }[] = [
    {
      title: "Desliza",
      body: "El mazo de la noche: los mejores lugares de hoy, uno por uno, ordenados por lo que te late.",
      Icon: Sparkles,
    },
    {
      title: "Mapa en vivo",
      body: "Todo el catálogo en un mapa en vivo — busca por zona, categoría o lo que se te antoje.",
      Icon: MapPin,
    },
    {
      title: "Social",
      body: "Sigue dónde andan tus amigos y la gente Premium ahora mismo, en tiempo real.",
      Icon: Users,
    },
    {
      title: "Concierge con IA",
      body: "Pregúntale con tus palabras y te ordena cada lugar por ambiente, zona, presupuesto y lo que está pasando en vivo.",
      Icon: MessageCircle,
    },
  ];
  return (
    <section id="descubrimiento" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Descubrimiento"
          title="Muchas formas de explorar, una sola inteligencia."
          aside="Desliza, busca en el mapa, sigue a tu gente o pregúntale al concierge con IA — la misma inteligencia detrás de todo."
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

export { DiscoveryIntelligence };
