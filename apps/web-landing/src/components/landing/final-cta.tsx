import { Store, UserCircle } from "lucide-react";
import { PathButton } from "@/components/landing/path-button";
import { BUSINESS_SIGNUP_URL, CONSUMER_URL } from "@/components/landing/urls";

function FinalCTA() {
  return (
    <section className="bg-hero border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center md:py-24">
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Tu plan de hoy, resuelto.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base">
          Los comensales descubren y ahorran. Los lugares llenan la sala con la
          gente que importa. Elige tu lado.
        </p>
        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
    </section>
  );
}

export { FinalCTA };
