import { Badge } from "./ui/badge";

export type ChipTone = "neutral" | "success" | "warning" | "danger";

/**
 * The one chip. success = done, live or on; warning = needs attention,
 * pending or fallback; danger = failed or blocked; neutral = everything else,
 * every category label included (told apart by text, never by hue). `dot`
 * marks a live or running state only.
 */
export function Chip({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...rest
}: {
  tone?: ChipTone;
  dot?: boolean;
  /** Layout only (margin). */
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"span">, "className" | "children">) {
  return (
    <Badge tone={tone} className={className} {...rest}>
      {dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </Badge>
  );
}
