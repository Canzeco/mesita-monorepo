import Image from "next/image";
import { Store, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PathButton } from "@/components/landing/path-button";
import { BUSINESS_SIGNUP_URL, CONSUMER_URL } from "@/components/landing/urls";

function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 pt-16 pb-12 text-center md:pt-24 md:pb-20">
        <Badge
          variant="outline"
          className="bg-background/70 text-muted-foreground rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
        >
          Hospitalidad inteligente · Hecho en Monterrey
        </Badge>

        <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
          ¿A dónde vamos hoy?
          <br />
          <span className="text-primary">Mesita lo sabe.</span>
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl">
          Todos los restaurantes, cafés, bares y antros de tu ciudad — hechos a
          tu medida, reservados por IA y más baratos solo por usar la app. Una
          sola app para los dos lados de la mesa.
        </p>

        {/* Doble CTA: botones simétricos para comensales y lugares. Misma
            forma, tamaño y hover; solo cambia el color para distinguirlos.
            Ambas rutas viven en subdominios de producción. */}
        <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <PathButton
            href={CONSUMER_URL}
            Icon={UserCircle}
            eyebrow="Voy a salir"
            label="Descargar app"
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
          Gratis para comensales · Listo en 10 minutos · Un descuento en cada
          visita
        </p>

        <figure className="border-border shadow-elev mt-8 w-full overflow-hidden rounded-3xl border md:mt-12">
          <Image
            src="/landing-hero.jpg"
            alt="Tacos y una bebida de Mesita en una terraza con el skyline de Monterrey detrás"
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

export { Hero };
