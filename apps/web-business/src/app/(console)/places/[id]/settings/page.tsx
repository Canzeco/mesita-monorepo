import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { Card } from "@/components/shell/Page";
import { LeavePlace } from "./LeavePlace";
import { TeamCard } from "@/components/team/TeamCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const METHOD: Record<string, string> = {
  phone_match: "your phone was the one on the listing",
  phone_code: "a code sent to the listing's phone",
  review: "Mesita reviewed your request",
};

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// The place's settings only: who runs it, its team, Leave. Billing moved to
// Premier and your email and sign-out live in Account alone (MESITA-3154:
// "account must not be redundant").
export default async function PlaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="flex flex-col gap-3">
        <p className="font-semibold">This place</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{manage.place.name}</dd>
          <dt className="text-muted-foreground">On Mesita</dt>
          <dd>{manage.place.listed === false ? "Hidden from guests by Mesita" : "Visible to guests"}</dd>
          {manage.manager ? (
            <>
              <dt className="text-muted-foreground">{manage.manager.role === "editor" ? "You edit it" : "You own it"}</dt>
              <dd>
                Until {day(manage.manager.expires_at)}, because {METHOD[manage.manager.method] ?? "you were verified"}.
              </dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">Access</dt>
              <dd>Mesita staff</dd>
            </>
          )}
        </dl>
        {manage.role !== "superadmin" ? <LeavePlace placeId={id} /> : null}
      </Card>
      <TeamCard placeId={id} />
    </div>
  );
}
