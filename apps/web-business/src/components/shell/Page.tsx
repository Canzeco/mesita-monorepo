// A page's header and body column (MESITA-3103).

import { cn } from "@/lib/utils";

// One header on every page (Pato, MESITA-3232): a white band across the whole
// page, the name and one line. The negative margins undo <main>'s padding in
// BusinessShell, and the space below matches its top padding.
export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="border-border bg-card -mx-4 -mt-6 mb-6 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-5 sm:-mx-6 sm:-mt-8 sm:mb-8 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="text-muted-foreground mt-0.5 text-sm">{sub}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // cn, so a card of rows' `p-0 sm:p-0` really is flush (MESITA-3177).
  return (
    <section
      className={cn(
        "border-border bg-card rounded-2xl border p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
