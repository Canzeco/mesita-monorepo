import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { Card } from "@/components/shell/Page";
import { LeavePlace } from "./LeavePlace";
import { AccountCard } from "@/components/shell/AccountCard";
import { TeamCard } from "@/components/team/TeamCard";
import { getIdentityCached } from "@/lib/identity";
import { getBilling, getPremier } from "@/lib/business-api";
import { BillingPanel } from "./BillingPanel";

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

// Billing lives here (MESITA-3136): the place's paid Premier, the card on it
// and every charge (business-web-get-billing). Update card's Checkout comes
// back with `?boost=<session>`, which business-web-get-premier settles first.
export default async function PlaceSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string }>;
}) {
  const { id } = await params;
  const { boost } = await searchParams;
  if (boost) await getPremier(id, boost);
  const [manage, identity, billing] = await Promise.all([getManagePlace(id), getIdentityCached(), getBilling(id)]);
  if (!manage) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-4 pb-8">
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
      <BillingPanel placeId={id} billing={billing.ok ? billing.data : null} error={billing.ok ? null : billing.error} saved={!!boost} />
      <AccountCard email={identity.ok ? identity.data.email : null} />
    </div>
  );
}
