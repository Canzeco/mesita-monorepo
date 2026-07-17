import { CalendarCheck, Compass, CreditCard } from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";
import {
  NumberedStepCard,
  type NumberedStep,
} from "@/components/landing/numbered-step-card";

function HowItWorks() {
  const steps: NumberedStep[] = [
    {
      n: "1",
      title: "Descubre",
      body: "Desliza los mejores lugares de hoy, explora el mapa en vivo o pregúntale a la IA: “una terraza para cena hoy, no tan cara”.",
      Icon: Compass,
    },
    {
      n: "2",
      title: "Reserva",
      body: "Elige hora y personas. Nuestro asistente llama, manda mensaje o correo al lugar y te confirma la mesa en minutos.",
      Icon: CalendarCheck,
    },
    {
      n: "3",
      title: "Paga menos",
      body: "En la mesa, el mesero escanea tu código y el descuento se aplica directo a la cuenta. Le pagas al lugar como siempre.",
      Icon: CreditCard,
    },
  ];
  return (
    <section id="como-funciona" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Cómo funciona"
          title="Tu plan de hoy, en tres pasos."
          aside="Descubre, reserva y paga menos — sin puntos que juntar y sin letras chiquitas."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <NumberedStepCard key={s.n} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

export { HowItWorks };
