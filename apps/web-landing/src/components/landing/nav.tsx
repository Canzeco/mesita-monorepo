import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_URL, CONSUMER_URL } from "@/components/landing/urls";

// One anchor per section, in page order. `footer.tsx` prints the same list.
export const NAV_LINKS = [
  { href: "/#guests", label: "Guests" },
  { href: "/#how", label: "How it works" },
  { href: "/#places", label: "Places" },
];

function Nav() {
  return (
    <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
        <Link
          href="/"
          className="text-primary font-display text-lg font-semibold tracking-tight"
        >
          Mesita
        </Link>
        <nav className="text-muted-foreground hidden items-center gap-7 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden min-h-9 rounded-full sm:inline-flex"
          >
            <a href={BUSINESS_URL}>For places</a>
          </Button>
          <Button asChild size="sm" className="min-h-9 rounded-full">
            <a href={CONSUMER_URL}>
              Open Mesita
              <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

export { Nav };
