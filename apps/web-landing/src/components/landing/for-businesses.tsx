import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_BENEFITS } from "@/components/landing/for-businesses-data";
import { ListedVsVerifiedDark } from "@/components/landing/listed-vs-verified-dark";
import { BUSINESS_SIGNUP_URL } from "@/components/landing/urls";

function ForBusinesses() {
  return (
    <section
      id="negocios"
      className="bg-foreground text-background border-border border-b"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-background/60 text-xs font-medium tracking-[0.18em] uppercase">
              Para negocios
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              ¿Tienes un lugar? Tus clientes ya están aquí.
            </h2>
          </div>
          <p className="text-background/70 max-w-sm text-sm">
            Tu perfil ya está en Mesita. Recláralo y convierte visibilidad en
            visitas — sin equipo especial, sin instalación.
          </p>
        </header>

        <ListedVsVerifiedDark />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {BUSINESS_BENEFITS.map((it) => {
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
            Gratis (listado) · Pro $100 MXN/mes · Ultra $5,000 MXN/mes — la misma
            mecánica, más visibilidad.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-background text-foreground hover:bg-background rounded-full hover:opacity-90"
          >
            <Link href={BUSINESS_SIGNUP_URL}>
              Reclama tu lugar
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export { ForBusinesses };
