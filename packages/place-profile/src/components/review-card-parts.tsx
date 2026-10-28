import { Star } from "lucide-react";
import { cn } from "../lib/format";

// Google's yellow for the earned stars, a pale grey for the rest (Pato,
// MESITA-2916: "use yellow here ... all gray just feels weird"). The empty
// stars used to have no fill at all, so a 1★ review drew one star and a gap.
export function StarRow({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-[#FBBC04]" : "fill-muted-foreground/25",
          )}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export function Quote({
  text,
  truncated,
  onExpand,
}: {
  text: string;
  truncated: boolean;
  onExpand?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          "text-foreground text-sm leading-snug",
          truncated && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="text-foreground self-start text-xs font-semibold hover:underline"
        >
          Read more
        </button>
      )}
    </div>
  );
}
