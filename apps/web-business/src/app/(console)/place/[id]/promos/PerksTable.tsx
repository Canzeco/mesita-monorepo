import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PARTNER_PERKS, type PerkCell } from "./perks";

function Cell({ value }: { value: PerkCell }) {
  if (value === "yes") {
    return (
      <Check
        className="text-foreground mx-auto h-4 w-4"
        strokeWidth={2.5}
        aria-label="Yes"
      />
    );
  }
  return (
    <span className="text-muted-foreground" aria-label="No">
      —
    </span>
  );
}

export function PerksTable() {
  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          What Listed places get versus Partners
        </caption>
        <thead>
          <tr className="border-border bg-muted/50 border-b">
            <th scope="col" className="px-3 py-2.5 text-[11px] font-semibold">
              Perk
            </th>
            <th
              scope="col"
              className="text-muted-foreground w-[5.5rem] px-2 py-2.5 text-center text-[11px] font-semibold"
            >
              Listed
            </th>
            <th
              scope="col"
              className="w-[5.5rem] px-2 py-2.5 text-center text-[11px] font-semibold text-[color:var(--brand-pink-text)]"
            >
              Partner
            </th>
          </tr>
        </thead>
        <tbody>
          {PARTNER_PERKS.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                "border-border",
                i < PARTNER_PERKS.length - 1 && "border-b",
              )}
            >
              <th
                scope="row"
                className="text-foreground px-3 py-2.5 text-[13px] font-medium leading-snug"
              >
                {row.label}
              </th>
              <td className="px-2 py-2.5 text-center">
                <Cell value={row.listed} />
              </td>
              <td className="bg-[color:var(--brand-pink-50)] px-2 py-2.5 text-center">
                <Cell value={row.partner} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground border-border border-t px-3 py-2.5 text-[11px] leading-snug">
        Badge and pin wait until you pick Conservative or Aggressive. Zero
        keeps Partnership and pauses discounts. Rank is never for sale.
      </p>
    </div>
  );
}
