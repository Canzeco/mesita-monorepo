import { BadgeCheck, CalendarCheck, CheckCircle2 } from "lucide-react";

function AIReservations() {
  return (
    <section id="reservas" className="border-border border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-24">
        <div className="flex flex-col gap-5">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Reservas con IA
          </p>
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
            Nunca vuelvas a llamar a un restaurante.
          </h2>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
            Pon hora y personas — el asistente de Mesita llama al lugar por
            teléfono y amarra la mesa. Funciona en todos los lugares de la
            ciudad, no solo en los que son socios. Confirmación al instante y
            ticket en la app.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Teléfono"].map((ch) => (
              <span
                key={ch}
                className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              >
                <CheckCircle2 className="text-secondary h-3.5 w-3.5" />
                {ch}
              </span>
            ))}
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
            El asistente contacta al lugar, acuerda el horario y te avisa cuando
            queda confirmada. Tú no marcas, no esperas en la línea, no mandas
            mensajes.
          </p>
          <span className="text-whatsapp inline-flex items-center gap-2 text-sm font-medium">
            <BadgeCheck className="h-4 w-4" />
            Confirmada en minutos
          </span>
        </div>
      </div>
    </section>
  );
}

export { AIReservations };
