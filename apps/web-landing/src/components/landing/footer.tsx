import Link from "next/link";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { NAV_LINKS } from "@/components/landing/nav";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="text-foreground flex items-center">
          <MesitaLogo variant="horizontal" className="h-6 w-auto" />
        </Link>
        <p className="text-muted-foreground text-[12px]">
          © Mesita · {year} · Launching in San Francisco, January 2027
        </p>
        <nav className="text-muted-foreground flex flex-wrap items-center gap-4 text-[12px]">
          {[...NAV_LINKS, ...LEGAL_LINKS].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground py-2 transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export { Footer };
