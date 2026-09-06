// Settings — the people who can reach this place, and who holds it.
//
// For an org-held place the ORG members are the team (autoplan D3/D4), so
// this leads with who the place owner is — the account that holds the staff
// PIN, the Partnership subscription, and the transfer — and points everyone
// else at the Organization screen. The place-team CRUD still renders for the
// place owner (it is how ownership transfers) and for pre-org places with
// real direct rows.
import Link from "next/link";
import { CircleUser } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { apiListTeam, type TeamSnapshot } from "@/lib/api/team";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { errMsg } from "@/lib/utils";
import { TeamClient } from "@/app/(console)/place/[id]/team/TeamClient";
import { requireTab } from "../tab-guard";

export const dynamic = "force-dynamic";

export default async function PlaceSettingsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, view } = await requireTab(id, "settings");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let snapshot: TeamSnapshot | null = null;
  let error: string | null = null;
  try {
    snapshot = await apiListTeam(supabase, id);
  } catch (err) {
    error = errMsg(err, "Couldn't load the team.");
  }

  if (!snapshot) {
    return (
      <PageErrorState
        heading="Couldn't load settings"
        message={error ?? "No data returned."}
        retryHref={`/places/${id}/settings`}
      />
    );
  }

  const owner = snapshot.members.find((m) => m.role === "owner") ?? null;
  const iAmPlaceOwner = owner?.userId === user?.id;

  return (
    <>
      {view.holder && (
        <Section
          title="Who can manage this place"
          description="Organization members reach this place; one account holds it."
        >
          <div className="flex flex-col gap-3">
            <div>
              <DataRow label="Place owner">
                {owner
                  ? (owner.fullName ?? owner.email ?? "Unknown")
                  : "Nobody yet"}
              </DataRow>
              <DataRow label="Organization">
                <Link
                  href={withOrg(
                    SHELL_ROUTES.organization,
                    view.holder.organizationId,
                  )}
                  className="hover:underline"
                >
                  {view.holder.organizationName}
                </Link>
              </DataRow>
            </div>
            <p className="text-muted-foreground text-[12px]">
              {iAmPlaceOwner
                ? "You hold this place: the staff PIN, the Partnership subscription, and ownership transfer are yours."
                : "Only the place owner can change the staff PIN, Partnership, and roles. Ownership transfers from this screen."}
            </p>
          </div>
        </Section>
      )}

      {(iAmPlaceOwner || snapshot.members.length > 1) && (
        <TeamClient
          projectId={id}
          currentUserId={user!.id}
          initialSnapshot={snapshot}
        />
      )}

      <Link
        href={SHELL_ROUTES.account}
        className="bg-card border-border hover:bg-muted flex items-center gap-3 rounded-2xl border p-4 transition"
      >
        <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <CircleUser className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="text-foreground block text-sm font-semibold">
            Account &amp; billing
          </span>
          <span className="text-muted-foreground block text-[13px]">
            Your account and its organizations.
          </span>
        </span>
      </Link>
    </>
  );
}
