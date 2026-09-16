import Link from "next/link";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { SHELL_ROUTES } from "@/lib/console-routes";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";

// What a flat address shows when the caller holds no place yet (MESITA-1832).
// One next step, and it is the same one for everybody now (MESITA-1892):
// claiming a place mints the claimer's own owner row, so there is no role to
// check and no organization to be an owner of first. The rail's Add place row
// stays above this card, so the console never shrinks.
export function NoPlaceYet() {
  return (
    <EmptyState
      icon={<Store className="h-5 w-5" />}
      title="No place yet"
      description="Search for your place. If Mesita already has it, claim it. If not, create it."
      action={
        <Link href={SHELL_ROUTES.placesNew} className={PILL_BUTTON_CLASS}>
          Add place
        </Link>
      }
    />
  );
}
