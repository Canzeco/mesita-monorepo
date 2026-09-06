// One row in either places list, plus its action. Claim and release are
// the same shape from the user's side — a row and one button — so they
// share PlaceHoldButton and cannot drift apart visually.
//
// The name leads to Place (the fifth screen) from BOTH lists: reading an
// address you are about to claim is exactly as reasonable as reading one
// you already hold, and business-web-get-place answers for both.
import Link from "next/link";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { placeHref, withOrg } from "@/lib/console-routes";
import type { ConsolePlace } from "@/lib/api/organizations";

export function PlaceRow({
  place,
  action,
  organizationId,
  allowed,
}: {
  place: ConsolePlace;
  action: "claim" | "release";
  organizationId: string;
  allowed: boolean;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b py-3.5 last:border-b-0">
      <div className="min-w-0">
        <Link
          href={withOrg(placeHref(place.id), organizationId)}
          className="truncate text-sm font-semibold hover:underline"
        >
          {place.name}
        </Link>
        <p className="text-muted-foreground truncate text-[12px]">
          {place.address ?? place.zone ?? "No address"}
        </p>
      </div>

      <PlaceHoldButton
        action={action}
        placeId={place.id}
        organizationId={organizationId}
        allowed={allowed}
      />
    </div>
  );
}
