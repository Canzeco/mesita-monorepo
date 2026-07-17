import Image from "next/image";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header({
  avatar,
  name,
  sub,
  rightChip,
  sourceLogo,
}: {
  avatar: React.ReactNode;
  name: string;
  sub: string;
  rightChip?: React.ReactNode;
  sourceLogo: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{name}</p>
          {rightChip}
        </div>
        <p className="text-muted-foreground truncate text-[11px]">{sub}</p>
      </div>
      {sourceLogo}
    </div>
  );
}

export function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-current" : "opacity-30",
          )}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export function Quote({
  text,
  italic,
  truncated,
  onExpand,
}: {
  text: string;
  italic?: boolean;
  truncated: boolean;
  onExpand?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          "text-foreground text-sm leading-snug",
          italic && "font-display italic",
          truncated && "line-clamp-4",
        )}
      >
        “{text}”
      </p>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="text-foreground self-start text-[11px] font-semibold hover:underline"
        >
          Read more
        </button>
      )}
    </div>
  );
}

export function Thumbnail({
  src,
  alt,
  aspect,
}: {
  src: string;
  alt: string;
  aspect: "square" | "portrait" | "landscape";
}) {
  // Photos sit in a 40-unit-wide (160px) frame centered in the card
  // rather than spanning full width — full-width portrait shots were
  // dominating the layout. The aspect class drives the height so a
  // story stays tall (160 × 213), a square food shot stays square
  // (160 × 160), and a landscape dining shot stays wide-short
  // (160 × 90).
  const aspectClass =
    aspect === "portrait"
      ? "aspect-[3/4]"
      : aspect === "landscape"
        ? "aspect-[16/9]"
        : "aspect-square";
  return (
    <div className="mt-auto flex justify-center">
      <div
        className={cn("relative w-40 overflow-hidden rounded-xl", aspectClass)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="160px"
          className="object-cover"
        />
      </div>
    </div>
  );
}
