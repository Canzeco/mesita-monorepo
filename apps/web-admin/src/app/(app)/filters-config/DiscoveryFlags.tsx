// Locked matrix marks. Squares = pools and modules. Circles = Places
// Lineup signals. Black / green = on. Grey / red = off. Map Randomness
// is 0, not missing.

export function Square({
  on,
  label,
}: {
  on: boolean;
  label: string;
}) {
  return (
    <span
      title={label}
      className={
        "inline-block size-3 rounded-[2px] " +
        (on ? "bg-foreground" : "border-muted-foreground/40 border bg-transparent")
      }
    />
  );
}

export function Flag({
  on,
  zero,
  label,
  shape,
}: {
  on: boolean;
  zero?: boolean;
  label: string;
  shape: "square" | "circle";
}) {
  return (
    <span className="inline-flex items-center justify-center gap-0.5" title={label}>
      <span
        className={
          "inline-block size-3 " +
          (shape === "circle" ? "rounded-full" : "rounded-[2px]") +
          " " +
          (on ? "bg-emerald-500" : "bg-rose-500")
        }
      />
      {zero ? (
        <span className="text-muted-foreground type-meta font-semibold">0</span>
      ) : null}
    </span>
  );
}
