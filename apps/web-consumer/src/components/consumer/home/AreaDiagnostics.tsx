// TEMPORARY (Pato, MESITA-2384): the Area breakdown the server computed
// for one place, drawn under its tile so the ranking can be judged on a
// phone. Every number is the server's (`place.area`, MESITA-2379); nothing
// here recomputes a score. `null` reads "n/a", never 0.
//
// TO REMOVE: delete this file, its one import and the `<AreaDiagnostics`
// item in CatalogRails.tsx, and the vitest that renders it. The server can
// keep sending `area` (it is ignored) until the Feed EF drops it.

import type { AreaDiagnostics as Area } from "@/lib/api/places";

/** Two decimals; null is "n/a". */
export function diagNumber(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "n/a";
}

function gate(v: 0 | 1 | null): string {
  return v === null ? "n/a" : String(v);
}

/** The compact expression for the place's formula. */
export function diagExpression(a: Area): string {
  const sel = diagNumber(a.selected);
  const fin = diagNumber(a.final);
  if (a.formula === "area") {
    return `area ${gate(a.gates.territory)} × popularity ${diagNumber(a.signals.popularity)} × selected ${sel} = ${fin}`;
  }
  return `base ${diagNumber(a.base)} × selected ${sel} = ${fin}`;
}

export function AreaDiagnostics({ area }: { area: Area }) {
  const families = area.familyKeys.length > 0 ? area.familyKeys.join(", ") : "none";
  return (
    <li
      className="bg-muted text-muted-foreground type-meta rounded-md px-2 py-1.5 font-mono leading-snug"
      aria-label="Score breakdown (temporary)"
      data-area-diagnostics
    >
      <p className="text-foreground font-semibold">{diagExpression(area)}</p>
      <p>
        {area.source} · family {gate(area.gates.family)} ({families})
        {area.gates.territory !== null ? ` · in area ${gate(area.gates.territory)}` : ""}
        {area.gates.radius !== null ? ` · radius ${gate(area.gates.radius)}` : ""}
        {` · ready ${gate(area.gates.ready)} · reviews ${gate(area.gates.reviews)}`}
      </p>
      <p>
        {area.formula === "point" ? `proximity ${diagNumber(area.signals.proximity)} · ` : ""}
        popularity {diagNumber(area.signals.popularity)} · selected ×{diagNumber(area.selected)}
      </p>
    </li>
  );
}
