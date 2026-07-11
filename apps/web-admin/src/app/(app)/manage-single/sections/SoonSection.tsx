import { Clock, type LucideIcon } from "lucide-react";

// Placeholder for tabs gated "Soon" in nav.ts. The tab bar already blocks
// navigation; this renders a friendly coming-soon state if a section URL is hit
// directly, instead of loading the not-yet-ready section.
export function SoonSection({
  label,
  Icon = Clock,
}: {
  label: string;
  Icon?: LucideIcon;
}) {
  return (
    <div className="border-border bg-card mx-auto mt-6 max-w-md rounded-2xl border px-6 py-12 text-center">
      <div className="bg-muted text-muted-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold">{label}</h2>
      <p className="text-muted-foreground mt-1 text-sm">This section is coming soon.</p>
    </div>
  );
}
