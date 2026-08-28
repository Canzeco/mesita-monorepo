import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// The empty state for a config page whose engine does not exist yet.
//
// Pato, 2026-08-21: "make the fucking page empty. maybe that is better. just
// leave a soon. don't hide the current configurations in the html. Literally
// delete it from the html. all that is in docs now, or must be."
//
// So this is deliberately not a disclosure and not a collapsed section: the
// controls are DELETED from the markup, not hidden. A staged knob still costs
// an operator the same attention as a live one, and a page of them is what
// made this console exhausting to read.
export function ConfigSoon({
  Icon,
  title,
  body,
  doc,
  footer,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  doc: string;
  footer?: ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="bg-muted/60 text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-display text-foreground text-lg font-semibold tracking-tight">
        {title}
      </p>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        {body}
      </p>
      {footer}
      <span className="bg-muted text-muted-foreground mt-1 rounded-full px-2 py-0.5 type-meta font-bold tracking-wider uppercase">
        Soon
      </span>
      <p className="text-muted-foreground/80 mt-1 type-label">{doc}</p>
    </div>
  );
}
