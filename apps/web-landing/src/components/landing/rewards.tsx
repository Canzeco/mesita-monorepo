import { CheckCircle2, CreditCard, QrCode, Receipt } from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

function Rewards() {
  const steps: {
    n: string;
    title: string;
    body: string;
    Icon: typeof QrCode;
  }[] = [
    {
      n: "1",
      title: "Escanea tu código",
      body: "El mesero escanea el código de tu tarjeta Mesita. Nada que instalar para ellos — funciona por WhatsApp o web.",
      Icon: QrCode,
    },
    {
      n: "2",
      title: "Registran la cuenta",
      body: "Mesita aplica tu descuento — de 10 a 70% — al momento y muestra el nuevo total a ti y al mesero.",
      Icon: Receipt,
    },
    {
      n: "3",
      title: "Pagas menos, directo",
      body: "Le pagas al lugar por cualquier método, efectivo o tarjeta. Mesita nunca toca tu dinero — sin intermediarios, sin esperas.",
      Icon: CreditCard,
    },
  ];
  return (
    <section id="recompensas" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Recompensas"
          title="Paga menos solo por ir."
          aside="Los lugares verificados te dan un descuento de bienvenida en tu primera visita y otro en cada visita después — directo a la cuenta."
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
          Sin reembolsos, sin monedero, sin factura. El descuento es el gasto de
          marketing del propio lugar, aplicado en su propia cuenta.
        </p>
      </div>
    </section>
  );
}

export { Rewards };
