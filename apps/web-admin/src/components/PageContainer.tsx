// A page's body column and its header band (MESITA-3261, from web-business's
// shell/Page.tsx). Both sit in this file because the band's negative margins
// undo exactly the padding the column sets.

/** The white band across the whole pane. Exported for the loading screen. */
export const PAGE_BAND_CLASS =
  "border-border bg-card -mx-4 -mt-6 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-5 sm:-mx-6 sm:-mt-8 sm:px-6 lg:-mx-8 lg:px-8";

// Every authenticated admin surface. Full width of the pane, as in Business.
export function PageContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14 lg:px-8" +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </div>
  );
}

// No bottom margin, unlike Business: admin pages set their own gap under the
// header (`mt-6 sm:mt-8`, or `gap-6 sm:gap-8` on the container).
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
