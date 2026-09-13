import Link from "next/link";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { canAddPlace } from "@/lib/active-organization";
import { SHELL_ROUTES, orgPlacesHref, orgPlacesNewHref } from "@/lib/console-routes";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import type { Organization } from "@/lib/api/organizations";

// What a place page shows when the organization holds no place yet
// (MESITA-1832). One next step, for the role that may take it; the rail's
// five rows stay above it, muted, so the console never shrinks.
export function NoPlaceYet({ org }: { org: Organization | null }) {
  const icon = <Store className="h-5 w-5" />;
  if (!org) {
    return (
      <EmptyState
        icon={icon}
        title="No organization yet"
        description="Create one, then add the place it runs."
        action={
          <Link href={SHELL_ROUTES.orgNew} className={PILL_BUTTON_CLASS}>
            Create organization
          </Link>
        }
      />
    );
  }
  if (canAddPlace(org.myRole)) {
    return (
      <EmptyState
        icon={icon}
        title="No place yet"
        description="Search for the place. If Mesita has it, add it to this organization. If not, create it."
        action={
          <Link href={orgPlacesNewHref(org.id)} className={PILL_BUTTON_CLASS}>
            Add place
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={icon}
      title="No place yet"
      description="This organization holds no place. Its owner can add one."
      action={
        <Link href={orgPlacesHref(org.id)} className={PILL_BUTTON_CLASS}>
          All places
        </Link>
      }
    />
  );
}
