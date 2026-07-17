import type { ReactNode } from "react";
import { CheckCircle2, Clock, X } from "lucide-react";

export function StatusBadge({
  status,
  decidedVia,
}: {
  status: "pending" | "approved" | "rejected";
  decidedVia: "auto" | "admin" | null;
}) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="bg-secondary/15 text-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
        <CheckCircle2 className="h-3 w-3" />
        Approved
        {decidedVia === "auto" && <span>· auto</span>}
      </span>
    );
  }
  return (
    <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
      <X className="h-3 w-3" />
      Rejected
    </span>
  );
}

export function KV({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-muted-foreground text-[9px] font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
