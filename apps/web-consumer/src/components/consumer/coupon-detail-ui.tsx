import type { LucideIcon } from "lucide-react";

import type { StatusMeta } from "@/components/consumer/coupon-status";
import { cn } from "@/lib/utils";

export function StatusBanner({
  banner,
}: {
  banner: NonNullable<StatusMeta["banner"]>;
}) {
  const tone = {
    info: "border-sky-400/30 bg-sky-50 text-sky-900",
    warn: "border-amber-400/30 bg-amber-50 text-amber-900",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    muted: "border-border bg-muted text-muted-foreground",
  }[banner.tone];
  return (
    <p
      className={cn(
        "rounded-2xl border px-3 py-2.5 text-[12.5px] leading-snug",
        tone,
      )}
    >
      {banner.text}
    </p>
  );
}

export function MetaRow({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="text-muted-foreground h-4 w-4" strokeWidth={2} />
      <span className="text-muted-foreground flex-1 text-[12px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold">{value}</span>
    </div>
  );
}
