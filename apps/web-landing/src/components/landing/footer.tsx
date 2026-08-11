import Link from "next/link";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { BUSINESS_SIGNIN_URL } from "@/components/landing/urls";

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="text-foreground flex items-center">
          <MesitaLogo variant="horizontal" className="h-6 w-auto" />
        </div>
        <p className="text-muted-foreground text-[12px]">
          © Mesita · {year} · Hospitalidad inteligente desde 2026 · Hecho en
          Monterrey
        </p>
        <nav className="text-muted-foreground flex flex-wrap items-center gap-4 text-[12px]">
          <a href="#como-funciona" className="hover:text-foreground transition">
            Cómo funciona
          </a>
          <a href="#recompensas" className="hover:text-foreground transition">
            Recompensas
          </a>
          <a href="#negocios" className="hover:text-foreground transition">
            Para negocios
          </a>
          <Link
            href={BUSINESS_SIGNIN_URL}
            className="hover:text-foreground transition"
          >
            Acceso para negocios
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export { Footer };
