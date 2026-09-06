// A future box, honestly. One dashed row — title, one line, a Soon pill —
// never a full-rank card: dashed reads "not yet real" against the solid live
// Sections (the disabled-row idiom), and the one-line
// height is what keeps three of these stacked from becoming gray porridge.
// House law: an unbuilt engine shows Soon, never knobs, never a fake feed.

export function SoonStrip({ title, line }: { title: string; line: string }) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-xl border border-dashed px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground truncate text-sm">{line}</p>
      </div>
      <span className="text-muted-foreground border-border shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Soon
      </span>
    </div>
  );
}
