// One standardized Discovery box (MESITA-2303). Every mode on Modes is the
// same card with the same four parts, in this order: Explanation · Sources ·
// Parameters · Save. The icon sits in a tile beside the title. A box with
// nothing to save passes no `save`.

import { KnobState } from "@/components/admin-ui/config";

export type ModeBoxSource = {
  name: string;
  returns: string;
  /** Set when no engine calls this source yet. */
  notWired?: string;
};

function Part({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-3 border-t px-4 py-4 sm:px-6">
      <p className="text-muted-foreground type-meta font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

export function ModeBox({
  id,
  icon,
  title,
  explanation,
  sources,
  children,
  save,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  explanation: React.ReactNode;
  sources: readonly ModeBoxSource[];
  /** The Parameters part. */
  children: React.ReactNode;
  /** The Save part. */
  save?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-border bg-card scroll-mt-16 overflow-hidden rounded-2xl border"
    >
      <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
        <span
          aria-hidden
          className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        >
          {icon}
        </span>
        <h2
          id={`${id}-title`}
          className="font-display text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
      </div>
      <Part label="Explanation">
        <div className="text-foreground max-w-3xl text-sm leading-relaxed">
          {explanation}
        </div>
      </Part>
      <Part label="Sources">
        <ul className="flex flex-col gap-2">
          {sources.map((source) => (
            <li
              key={source.name}
              className="flex flex-col gap-0.5 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-3"
            >
              <span className="font-semibold sm:min-w-72">{source.name}</span>
              <span className="text-muted-foreground">{source.returns}</span>
              {source.notWired ? (
                <KnobState kind="not-wired" reason={source.notWired} />
              ) : null}
            </li>
          ))}
        </ul>
      </Part>
      <Part label="Parameters">{children}</Part>
      {save ? (
        <div className="border-border bg-muted/30 border-t px-4 pb-4 sm:px-6">
          {save}
        </div>
      ) : null}
    </section>
  );
}

/** A parameter the box names that nothing reads yet: no stored value. */
export function NotWiredParam({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-medium leading-snug">{label}</span>
      <KnobState kind="not-wired" reason={reason} />
    </div>
  );
}
