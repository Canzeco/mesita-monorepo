import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { SHELL_ROUTES } from "@/lib/console-routes";

/** Every places screen needs an organization to be about. Without one
 *  there is nothing to hold places, so both lists send you to create one
 *  rather than rendering an empty table that implies otherwise. */
export function NoOrganization() {
  return (
    <EmptyState
      icon={<Building2 className="text-muted-foreground h-5 w-5" />}
      title="No organization yet"
      description="Places are held by an organization. Create one and you can claim places into it."
      action={
        <Link href={SHELL_ROUTES.organization} className={CTA_BUTTON_CLASS}>
          Create an organization
        </Link>
      }
    />
  );
}
