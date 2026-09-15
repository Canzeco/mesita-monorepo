// A future box, honestly. One dashed row — title, one line, a Soon pill —
// never a full-rank card: dashed reads "not yet real" against the solid live
// Sections (the disabled-row idiom), and the one-line
// height is what keeps three of these stacked from becoming gray porridge.
// House law: an unbuilt engine shows Soon, never knobs, never a fake feed.
//
// h3, like Section (MESITA-1847). It was an h2 — so the page's least
// important box outranked every live one in the outline while reading as the
// quietest thing on screen.
//
// ── IT NOW WEARS SECTION'S GEOMETRY (MESITA-1861) ─────────────────────────
//
// The outline rank was fixed; the VISUAL rank was still backwards. This drew
// `rounded-xl px-5 py-4` with a 15px title against Section's `rounded-2xl
// p-4` and 14px — so on Configuration, Brand and Developers (the two boxes
// that do not exist) carried the biggest type and the tightest radius on the
// page, and read as the loudest things on it. Two box families disagreeing on
// three values is not a style; it is drift nobody measured.
//
// Radius, padding and title size now come from Section. What stays is the
// DASHED border and the absent shadow — Section lifts with `shadow-card`,
// this lies flat. One honest signal instead of three accidental ones, and the
// difference now reads as rank rather than as a different component.
//
// IT DOES NOT TAKE SECTION'S LANE. Customers and Payments are nothing BUT a
// Soon strip, and a 288px label lane on a page holding one strip would leave
// MORE white, not less — the exact failure this issue is fixing on
// Configuration. A strip stays one row at every width.

export function SoonStrip({ title, line }: { title: string; line: string }) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-2xl border border-dashed p-4">
      <div className="min-w-0">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h3>
        <p className="text-muted-foreground mt-0.5 truncate text-[12px] leading-snug">
          {line}
        </p>
      </div>
      <span className="text-muted-foreground border-border shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Soon
      </span>
    </div>
  );
}
