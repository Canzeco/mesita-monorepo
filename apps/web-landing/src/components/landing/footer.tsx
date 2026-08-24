import Link from "next/link";
import { MesitaLogo } from "@/components/brand/MesitaLogo";

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="text-foreground flex items-center">
          <MesitaLogo variant="horizontal" className="h-6 w-auto" />
        </Link>
        <p className="text-muted-foreground text-[12px]">
          © Mesita · {year} · Built in Monterrey · Launching in California,
          January 2027
        </p>
        <nav className="text-muted-foreground flex flex-wrap items-center gap-4 text-[12px]">
          <a href="#catalog" className="hover:text-foreground py-2 transition">
            Catalog
          </a>
          <a href="#agents" className="hover:text-foreground py-2 transition">
            Agents
          </a>
          <a href="#passport" className="hover:text-foreground py-2 transition">
            Passport
          </a>
          <a href="#money" className="hover:text-foreground py-2 transition">
            Money
          </a>
        </nav>
      </div>
    </footer>
  );
}

export { Footer };
