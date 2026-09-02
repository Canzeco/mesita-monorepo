// Locked matrix marks. Squares = entities and pools. Circles = Places
// Lineup signals; sources are squares that fire. Black / green = on.
// Grey / red = off. `module` is retired as a Discovery noun.

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
  label,
  shape,
}: {
  on: boolean;
  label: string;
  shape: "square" | "circle";
}) {
  return (
    <span className="inline-flex items-center justify-center" title={label}>
      <span
        className={
          "inline-block size-3 " +
          (shape === "circle" ? "rounded-full" : "rounded-[2px]") +
          " " +
          (on ? "bg-emerald-500" : "bg-rose-500")
        }
      />
    </span>
  );
}
