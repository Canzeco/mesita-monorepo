import { cn } from "./cn";

// Page chrome (MESITA-3261, MESITA-3948). Server-safe: no hooks, no handlers.
// The band's negative margins undo exactly the padding the column sets.

/** The white band across the whole pane. Exported for the loading screen. */
export const PAGE_BAND_CLASS =
  "border-border bg-card -mx-4 -mt-6 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-5 sm:-mx-6 sm:-mt-8 sm:px-6 lg:-mx-8 lg:px-8";

/** Every authenticated admin surface. Full width of the pane. */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  /** Layout only (gap, grid); never colour, radius or padding. */
  className?: string;
}) {
  return (
    <div className={cn("w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14 lg:px-8", className)}>
      {children}
    </div>
  );
}

/** The page title band. Page-level actions go in `right`, which wraps under the title below sm. */
export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className={PAGE_BAND_CLASS}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-0.5 text-sm">{description}</p> : null}
      </div>
      {right}
    </header>
  );
}

/** Template (a): a config page — container, header, then the cards. */
export function ConfigPageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      {/* The body sets its own gap: its first child can be a zero-height sticky strip (Crenup). */}
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
