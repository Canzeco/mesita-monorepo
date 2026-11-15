import { cn } from "@/lib/utils";

// ONE BUBBLE, ONE SIZE (Pato, 2026-11-14, MESITA-3996: "ALL BUBBLES MUST BE
// THE SAME SIZE, NOT RED SMALL AND RED BIG"). Every badge in the app — a Me
// box's state, the bar's Me tab — is this 20px pill with a number in it.
// There is no bare dot: something waiting is a count, even when it is 1.

/** A count past nine reads "9+", so the pill keeps one width. */
export function countText(n: number): string {
  return n > 9 ? "9+" : String(n);
}

/** The app's one badge. Red says something waits for the guest; ink is a
 *  plain count (Reservations' upcoming). Decorative: the caller says the
 *  number to screen readers. */
export function CountBubble({
  count,
  tone = "red",
  className,
}: {
  count: number;
  tone?: "red" | "ink";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "animate-in fade-in inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 type-meta leading-none font-semibold tabular-nums duration-150",
        tone === "red" ? "bg-destructive text-white" : "bg-foreground text-paper",
        className,
      )}
      data-count-bubble
    >
      {countText(count)}
    </span>
  );
}
