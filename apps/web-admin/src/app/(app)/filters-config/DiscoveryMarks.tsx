// The locked matrix mark. ONE grammar, in ink (MESITA-1856).
//
// FILLED = on, HOLLOW = off, on every band. There used to be two grammars in
// one table: entities and place types said on with a filled square, while
// sources and signals said it with a green mark against a red one — a boolean
// encoded by HUE ALONE, identical in shape and size, and the only saturated
// colour on an ink-and-off-white page. Hue is gone; fill carries the boolean.
// The test next door asserts those two class names never come back.
//
// SHAPE STILL MEANS SOMETHING, and it is not the boolean: a square is a SET
// the mode draws from (an entity it answers with, a place type it requires, a
// source it calls), a circle is a Places Lineup signal that ranks what came
// back. `module` is retired as a Discovery noun.
//
// EVERY MARK CARRIES ITS OWN NAME. `title` is not an accessible name and
// never reaches the keyboard, so the visible mark is decorative and a
// visually-hidden span says the row, the mode and the state in words.

export function Mark({
  on,
  label,
  shape = "square",
}: {
  on: boolean;
  label: string;
  shape?: "square" | "circle";
}) {
  return (
    <span className="inline-flex items-center justify-center">
      <span
        aria-hidden
        title={label}
        className={
          "inline-block size-3 " +
          (shape === "circle" ? "rounded-full " : "rounded-[2px] ") +
          (on
            ? "bg-foreground"
            : "border-muted-foreground/40 border bg-transparent")
        }
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
