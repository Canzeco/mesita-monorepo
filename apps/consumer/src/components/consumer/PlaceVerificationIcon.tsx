import { Check, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Place-header verification badge.
 *
 * decision: Pato — partner = solid sky check (IG-style). Not verified must
 * NOT use ShieldAlert / amber warning (reads as a security vulnerability).
 * Use a muted slate disc + CircleHelp = soft "unconfirmed listing" (MESITA-277).
 */
export function PlaceVerificationIcon({
  listingType,
  className,
}: {
  listingType: "partner" | "web";
  className?: string;
}) {
  const verified = listingType === "partner";
  if (verified) {
    return (
      <span
        className={cn(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm ring-1 ring-black/10",
          className,
        )}
        aria-label="Verified Partner"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-slate-400 text-white shadow-sm ring-1 ring-black/10",
        className,
      )}
      aria-label="Not a verified partner"
    >
      <CircleHelp className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

/** Centered title row: Name + verification icon (place profile chrome). */
export function PlaceNameWithVerification({
  name,
  listingType,
}: {
  name: string;
  listingType: "partner" | "web";
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5">
      <span className="truncate">{name}</span>
      <PlaceVerificationIcon listingType={listingType} />
    </span>
  );
}
