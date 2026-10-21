import { Check } from "lucide-react";

// One list of perks, shared by Me › Plan and the Class sheet (MESITA-2553).
// A perk that is true today wears a check; one that is not built yet wears a
// dot and its own "Soon", so a quick scan never reads an unbuilt perk as
// included.

export type Perk = { text: string; soon?: boolean };

export function PerkList({ label, items }: { label: string; items: Perk[] }) {
  return (
    <ul role="list" aria-label={label} className="mt-2 flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.text}
          className="text-foreground type-body flex items-start gap-2"
          data-perk-soon={item.soon ? "" : undefined}
        >
          {item.soon ? (
            <span
              className="bg-muted-foreground/40 mt-[0.45rem] ml-1 h-1.5 w-1.5 shrink-0 rounded-full"
              aria-hidden
            />
          ) : (
            <Check
              className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden
            />
          )}
          <span>
            {item.text}
            {item.soon && (
              <span className="bg-muted text-muted-foreground type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold">
                Soon
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
