import { BadgeCheck, Instagram, type LucideIcon, Sparkles } from "lucide-react";
import { FeatureCard } from "@/components/landing/feature-card";
import { SectionFooter } from "@/components/landing/section-footer";
import { SectionHeader } from "@/components/landing/section-header";
import { CONSUMER_URL } from "@/components/landing/urls";

function Premium() {
  const doors: { title: string; body: string; Icon: LucideIcon }[] = [
    {
      title: "Instagram",
      body: "Gratis. Verifica una cuenta con más de 2,000 seguidores y sube una historia etiquetando al lugar para liberar cada recompensa.",
      Icon: Instagram,
    },
    {
      title: "Suscripción",
      body: "$100 MXN al mes. Los mejores descuentos en todos lados, sin subir historia, nunca.",
      Icon: BadgeCheck,
    },
    {
      title: "Invitación",
      body: "Para quien mueve la noche: chefs, modelos, creadores, prensa y fundadores — la gente que los lugares quieren en su sala.",
      Icon: Sparkles,
    },
  ];
  return (
    <section id="premium" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Premium"
          title="Premium desbloquea los mejores descuentos."
          aside="Todos empiezan gratis — descubrimiento completo, reservas con IA y un descuento en cada lugar verificado. Premium sube los descuentos en todos lados."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {doors.map((d) => (
            <FeatureCard
              key={d.title}
              title={d.title}
              body={d.body}
              Icon={d.Icon}
              iconClass="bg-secondary/10 text-secondary"
            />
          ))}
        </div>
        <SectionFooter
          note="Gratis para siempre. Premium se gana gratis con Instagram, o cuesta $100 MXN al mes."
          cta={{ href: CONSUMER_URL, label: "Descargar app" }}
          variant="primary"
        />
      </div>
    </section>
  );
}

export { Premium };
