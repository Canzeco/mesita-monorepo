import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { Card } from "@/components/shell/Page";
import { LeavePlace } from "./LeavePlace";
import { ProductList } from "@/components/shell/ProductList";

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

export default async function PlaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
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
              <dt className="text-muted-foreground">You run it</dt>
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
        <p className="text-muted-foreground text-sm">Team members and roles are not available yet: each person claims the place with their own Google account.</p>
        {manage.role === "owner" ? <LeavePlace placeId={id} /> : null}
      </Card>
      <ProductList />
    </div>
  );
}
