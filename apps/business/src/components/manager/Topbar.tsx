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
    <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3.5 pl-14 backdrop-blur-md md:gap-4 md:px-6 md:py-4 md:pl-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-lg leading-tight font-semibold tracking-tight md:text-xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 truncate text-[12px] leading-snug md:text-[13px]">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
