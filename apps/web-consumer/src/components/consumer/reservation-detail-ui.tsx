import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetaRow({
  Icon,
  iconClass,
  label,
  value,
}: {
  Icon: typeof Clock;
  iconClass?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon
        className={cn("text-muted-foreground h-4 w-4", iconClass)}
        strokeWidth={2}
      />
      <span className="text-muted-foreground flex-1 text-[12px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold">{value}</span>
    </div>
  );
}

