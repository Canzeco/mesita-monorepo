import { cn } from "@/lib/utils";

// Minimal manager topbar: just the page title + optional subtitle.
// Everything else (AppSwitcher, global search, notifications) was either
// disabled placeholder UI or surface clutter — removed until real
// implementations exist.
//
// `innerClassName` lets a page constrain the title row to the same
// container width as its content below (e.g. `mx-auto w-full max-w-6xl`)
// so the title and the content cards share a left edge. Without it the
// title sits flush to the manager content area's edge, which on a wide
// monitor reads as misaligned when the content is centered with a
// max-width.
export function Topbar({
  title,
  subtitle,
  innerClassName,
}: {
  title: string;
  subtitle?: string;
  innerClassName?: string;
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-20 backdrop-blur-md">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-4 pl-14 md:gap-4 md:px-8 md:pl-8",
          innerClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-xl leading-none font-semibold tracking-tight md:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1 truncate text-[13px] leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
