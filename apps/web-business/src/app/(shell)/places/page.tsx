// Org Places — what this organization holds. Release sends one back to the
// public pool; the row links into the real per-place console.
import { Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceRow } from "@/components/console/PlaceRow";
import { NoOrganization } from "@/components/console/NoOrganization";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiListConsolePlaces,
  apiListOrganizations,
  type ConsolePlace,
} from "@/lib/api/organizations";
import { canRelease, resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrgPlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/places");

  const orgs = await apiListOrganizations(supabase).catch(() => []);
  const org = resolveActiveOrg(orgs, sp.org);
  if (!org) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Org Places
        </h1>
        <NoOrganization />
      </>
    );
  }

  let places: ConsolePlace[] = [];
  let error: string | null = null;
  try {
    places = await apiListConsolePlaces(supabase, {
      scope: "org",
      organizationId: org.id,
    });
  } catch (e) {
    error = errMsg(e, "Couldn't load this organization's places.");
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Org Places
          </h1>
          <p className="text-muted-foreground text-[13px]">
            Held by {org.name}
          </p>
        </div>
        <Link
          href={withOrg(SHELL_ROUTES.pool, org.id)}
          className={CTA_BUTTON_CLASS}
        >
          Claim from the pool
        </Link>
      </div>

      {error ? (
        <PageErrorState
          heading="Couldn't load these places"
          message={error}
          retryHref={withOrg(SHELL_ROUTES.places, org.id)}
        />
      ) : places.length === 0 ? (
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title="No places yet"
          description="Every place starts in the public pool. Claim one and it shows up here."
          action={
            <Link
              href={withOrg(SHELL_ROUTES.pool, org.id)}
              className={CTA_BUTTON_CLASS}
            >
              Browse the pool
            </Link>
          }
        />
      ) : (
        <div className="border-border bg-card rounded-2xl border px-4">
          {places.map((p) => (
            <PlaceRow
              key={p.id}
              place={p}
              action="release"
              organizationId={org.id}
              allowed={canRelease(org.myRole)}
            />
          ))}
        </div>
      )}
    </>
  );
}
