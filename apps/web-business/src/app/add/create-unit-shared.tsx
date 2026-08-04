import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  MapPin,
  Phone,
} from "lucide-react";
import type { PredictionStatus } from "@/lib/api/places";
import type { LookupPlace } from "@/lib/api/verifications";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Callbacks the parent provides for each terminal outcome of a
// verification flow. The picker + bodies are self-contained but don't
// know the page's routing strategy.
export type VerificationCallbacks = {
  supabase: SupabaseClient;
  signedInEmail: string;
  onApproved: (projectId: string) => void;
  onAwaitingAdmin: () => void;
};

// ── Shared bits ───────────────────────────────────────────────────────

export function ErrorBlurb({ children }: { children: ReactNode }) {
  return <p className={cn(ERROR_BOX_CLASS, "text-sm")}>{children}</p>;
}

export const PREDICTION_BADGE: Record<
  PredictionStatus,
  {
    label: string;
    Icon: typeof MapPin;
    iconClass: string;
    badgeClass: string;
  }
> = {
  not_in_mesita: {
    label: "Not on Mesita",
    Icon: MapPin,
    iconClass: "bg-muted text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
  web_listed: {
    label: "Web listed",
    Icon: MapPin,
    iconClass: "bg-secondary/15 text-secondary",
    badgeClass: "bg-secondary/15 text-secondary",
  },
  verified_partner_other: {
    label: "Verified partner",
    Icon: CheckCircle2,
    iconClass: "bg-amber-100 text-amber-700",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  verified_partner_self: {
    label: "You own this",
    Icon: Crown,
    iconClass: "bg-pink-gradient text-white",
    badgeClass: "bg-pink-gradient text-white",
  },
};

export function PlaceIdentity({ place }: { place: LookupPlace }) {
  return (
    <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4">
      <p className="font-display text-lg leading-tight font-semibold tracking-tight">
        {place.name}
      </p>
      <div className="text-muted-foreground flex flex-col gap-1.5 text-[12px] sm:flex-row sm:items-center sm:gap-4">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-mono">
            {place.phone ?? (
              <span className="text-muted-foreground italic">
                no phone listed
              </span>
            )}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={place.address ?? undefined}>
            {place.address ?? "no address"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "muted" | "info" | "warn" | "secondary";
  children: ReactNode;
}) {
  const cls = {
    muted: "bg-muted text-muted-foreground",
    info: "bg-secondary/15 text-secondary",
    warn: "bg-amber-100 text-amber-700",
    secondary: "bg-secondary/15 text-secondary",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase",
        cls,
      )}
    >
      {children}
    </span>
  );
}

export function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function MockCodePill({ code }: { code: string }) {
  return (
    <p className="inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
      <AlertTriangle className="h-3 w-3" />
      Mock mode · type{" "}
      <span className="font-mono font-bold tracking-[0.18em] text-amber-900">
        {code}
      </span>
    </p>
  );
}
