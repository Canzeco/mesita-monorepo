// Minimal manager topbar: just the page title + optional subtitle.
// Everything else (AppSwitcher, global search, notifications) was either
// disabled placeholder UI or surface clutter — removed until real
// implementations exist.
export function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-20 flex items-center gap-3 px-4 py-4 pl-14 backdrop-blur-md md:gap-4 md:px-8 md:pl-8">
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
    </header>
  );
}
