import { businessPlaceHref } from "@/lib/business-url";
import { listPremier, type PremierRow } from "./actions";

// Under the Boost box (MESITA-3188, Pato: "remove the premier page here. that
// goes inside manage multiple places"): the places Premier now, or with a
// subscription renewal or Checkout in flight, each opening in Business. A
// server component, so a slow read never holds the rest of the tool.

const MARK: Record<number, string> = { 1: "2X", 2: "5X" };

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function standing(p: PremierRow): string {
  if (p.charging) return "Charging at Stripe…";
  const parts = [
    p.manual ? `Boost ${MARK[p.manual.tier] ?? ""} until ${day(p.manual.ends_at)}` : null,
    p.period ? `Plan ${MARK[p.period.tier] ?? ""} until ${day(p.period.ends_at)}` : null,
    p.backups > 0 && !p.period ? "Plan renews within 5 minutes" : null,
    p.waiting > 0 ? `${p.waiting} waiting at Checkout` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function PremierNow() {
  const res = await listPremier();
  const rows = res.ok
    ? res.list.places
        .filter((p) => p.tier > 0 || p.charging || p.backups > 0 || p.waiting > 0)
        .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium">Premier now</h4>
      {!res.ok ? (
        <p className="text-destructive mt-2 text-sm">{res.error}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">No place is Premier.</p>
      ) : (
        <ul className="border-border bg-card divide-border/60 mt-2 divide-y overflow-hidden rounded-2xl border">
          {rows.map((p) => {
            const href = businessPlaceHref(p.id, "premier");
            const body = (
              <>
                <span className="w-8 shrink-0 text-sm font-semibold">{MARK[p.tier] ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="text-muted-foreground block truncate text-sm">{standing(p)}</span>
                </span>
              </>
            );
            return (
              <li key={p.id}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener" className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3">
                    {body}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
