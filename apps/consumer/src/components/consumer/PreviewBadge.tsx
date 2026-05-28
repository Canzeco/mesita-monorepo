import { cn } from "@/lib/utils";

// Compact "Preview · mock data" pill shown above pages where the data
// is still mocked. Replaces the older multi-line alert paragraphs that
// ate too much vertical space on small viewports. Keep the copy to a
// single line; longer disclosures belong in the underlying card copy,
// not in a top-of-page banner.
export function PreviewBadge({
  label = "Preview · mock data",
  align = "stretch",
  className,
}: {
  label?: string;
  align?: "stretch" | "center";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "bg-secondary/10 text-secondary rounded-full px-3 py-1 text-center text-[10.5px] font-medium",
        align === "center" && "mx-auto inline-block",
        className,
      )}
    >
      {label}
    </p>
  );
}
