import { BadgeCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Blue IG-style check when Verified Partner; yellow alert when not. */
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
      <BadgeCheck
        className={cn("h-4 w-4 shrink-0 fill-sky-500 text-white", className)}
        aria-label="Verified Partner"
        strokeWidth={2}
      />
    );
  }
  return (
    <ShieldAlert
      className={cn("h-4 w-4 shrink-0 text-amber-500", className)}
      aria-label="Not verified"
    />
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
