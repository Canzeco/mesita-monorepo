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

/** The compact expression for the place's formula: Proximity ×
 *  Popularity, × Official's tier number (MESITA-2925; no exponents since
 *  MESITA-2722). */
export function diagExpression(a: Area): string {
  const fin = diagNumber(a.final);
  const sel = typeof a.selectedFactor === "number" && a.selectedFactor !== 1
    ? ` × official ${a.selectedFactor}`
    : "";
  const rest = `popularity ${diagNumber(a.signals.popularity)}${sel}`;
  // Home asks from a point or nothing (MESITA-2501); anything but a point
  // has no Proximity term.
  if (a.formula !== "point") return `${rest} = ${fin}`;
  return `proximity ${diagNumber(a.signals.proximity)} × ${rest} = ${fin}`;
}

export function AreaDiagnostics({ area }: { area: Area }) {
  const families =
    area.familyKeys.length > 0 ? area.familyKeys.join(", ") : "none";
  return (
    <li
      className="bg-muted text-muted-foreground type-meta rounded-lg px-2 py-1.5 font-mono leading-snug"
      aria-label="Score breakdown (temporary)"
      data-area-diagnostics
    >
      <p className="text-foreground font-semibold">{diagExpression(area)}</p>
      <p>
        {area.source} · family {gate(area.gates.family)} ({families})
        {area.gates.radius !== null
          ? ` · radius ${gate(area.gates.radius)}`
          : ""}
        {` · ready ${gate(area.gates.ready)} · reviews ${gate(area.gates.reviews)}`}
      </p>
      <p>
        {area.formula === "point"
          ? `proximity ${diagNumber(area.signals.proximity)} · `
          : ""}
        popularity {diagNumber(area.signals.popularity)}
        {area.foundBy && area.foundBy.length > 0 ? ` · found by ${area.foundBy.join(", ")}` : ""}
      </p>
    </li>
  );
}
