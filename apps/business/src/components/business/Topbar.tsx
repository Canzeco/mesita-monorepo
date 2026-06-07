import { cn } from "@/lib/utils";

// Mobile app bar for the venue console: page title + optional subtitle,
// pinned to the top of the scrollable body inside the phone frame.
// (Previously a desktop topbar with hamburger padding — the sidebar is
// gone now, replaced by the BottomNav, so the title can sit flush.)
//
// `innerClassName` is kept for back-compat with pages that pass a
// container width; inside the max-w-md frame it's effectively a no-op but
// harmless.
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
    <header className="border-border bg-background/85 sticky top-0 z-20 shrink-0 border-b backdrop-blur-md">
      <div
        className={cn("flex items-center gap-3 px-4 py-3.5", innerClassName)}
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-lg leading-tight font-semibold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 truncate text-[12px] leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
