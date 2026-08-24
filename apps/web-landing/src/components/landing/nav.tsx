import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { NOTIFY_URL, OVERVIEW_URL } from "@/components/landing/urls";

const NAV_LINKS = [
  { href: "#catalog", label: "Catalog" },
  { href: "#agents", label: "Agents" },
  { href: "#passport", label: "Passport" },
  { href: "#money", label: "Money" },
];

function Nav() {
  return (
    <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="text-primary flex items-center">
          <MesitaLogo variant="horizontal" className="h-7 w-auto" />
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
            <a href={NOTIFY_URL}>Get notified</a>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <a href={OVERVIEW_URL}>
              Read the overview
              <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

export { Nav };
