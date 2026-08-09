function FAQ() {
  const items: { q: string; a: string }[] = [
    {
      q: "¿Mesita es gratis?",
      a: "Sí. Descubre, reserva y consigue descuentos sin pagar nada. Premium sube los descuentos en todos lados por $100 MXN al mes; Influencer es gratis con 2,000+ seguidores en Instagram.",
    },
    {
      q: "¿Cómo uso un descuento?",
      a: "Muestras tu código, el mesero lo escanea y el descuento se aplica directo a tu cuenta — de 10 a 70% en lugares verificados. Le pagas al lugar por cualquier método, efectivo o tarjeta. Mesita nunca toca tu dinero.",
    },
    {
      q: "¿Tengo que subir una historia?",
      a: "Solo si activas la recompensa de Historia con Instagram conectado: subes una historia etiquetando al lugar y completas la tarea en la app. La página de check es informativa — nadie en el lugar confirma ni aprueba. Premium e invitados Aura no suben historia.",
    },
    {
      q: "¿Puedo reservar en cualquier lugar?",
      a: "Sí — el asistente reserva en todos los lugares de la ciudad, no solo en los verificados. Pon hora y personas y contacta al lugar por teléfono, WhatsApp, Instagram o correo, por donde conteste.",
    },
    {
      q: "Tengo un lugar — ¿cuánto cuesta?",
      a: "Seguramente ya estás listado gratis. La Membresía Mesita (Verificado, MX$1,000/año) desbloquea Strategies de descuento, el tablero y el control del perfil; el Rank no se vende — la Strategy gana la visibilidad. Tú defines y financias tus propios descuentos, y Mesita nunca toca el pago. Listo en 10 minutos, sin equipo especial ni punto de venta.",
    },
    {
      q: "¿Mesita mueve o guarda dinero?",
      a: "Nunca. Mesita es un producto de suscripción, no un marketplace — sin reembolsos, sin monedero, sin intermediarios. El descuento es el gasto de marketing del propio lugar, aplicado en su propia cuenta, y el comensal le paga al lugar directo.",
    },
  ];
  return (
    <section id="faq" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Preguntas frecuentes
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          Lo esencial, para comensales y dueños de lugares por igual.
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

export { FAQ };
