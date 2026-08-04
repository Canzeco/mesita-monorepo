import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_SIGNUP_URL, CONSUMER_URL } from "@/components/landing/urls";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#recompensas", label: "Recompensas" },
  { href: "#premium", label: "Premium" },
  { href: "#negocios", label: "Para negocios" },
];

function Nav() {
  return (
    <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span aria-hidden className="text-xl">
            🌲
          </span>
          mesita
          <span className="text-primary">.</span>
        </Link>
        <nav className="text-muted-foreground hidden items-center gap-7 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden rounded-full sm:inline-flex"
          >
            <Link href={BUSINESS_SIGNUP_URL}>Tengo un lugar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href={CONSUMER_URL}>
              Descargar app
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export { Nav };
