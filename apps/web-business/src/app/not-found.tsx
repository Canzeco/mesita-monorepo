// App-wide 404. Without this, an unmatched URL renders Next's bare default
// with no navigation — a dead end in a standalone PWA window, where there
// is no address bar to type your way out of.
import Link from "next/link";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <MesitaLogo variant="horizontal" className="h-7 w-auto" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          That page moved
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          The console was reorganized. Pick a place from the catalog, or head to
          your organization.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/places" className={CTA_BUTTON_CLASS}>
          Browse places
        </Link>
        <Link
          href="/"
          className={cn(
            "border-border text-foreground rounded-full border px-5 py-2.5 text-sm font-semibold transition hover:opacity-80",
          )}
        >
          Organization
        </Link>
      </div>
    </div>
  );
}
