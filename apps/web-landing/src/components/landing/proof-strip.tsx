function ProofStrip() {
  const points: { stat: string; label: string }[] = [
    { stat: "Toda la ciudad", label: "ya está adentro" },
    { stat: "Reservas con IA", label: "en todos los lugares" },
    { stat: "Hasta 70%", label: "de descuento en lugares verificados" },
  ];
  return (
    <section className="border-border bg-background border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 md:py-14">
        <p className="text-muted-foreground mx-auto max-w-2xl text-center text-sm md:text-base">
          Mesita arranca llena. Cada restaurante, café, bar y antro está listo y
          enriquecido con IA — fotos, menús, horarios, ambiente — así que un
          lugar no{" "}
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

export { ProofStrip };
