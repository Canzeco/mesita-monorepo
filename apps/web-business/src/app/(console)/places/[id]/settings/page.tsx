import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { Card } from "@/components/shell/Page";
import { LeavePlace } from "./LeavePlace";
import { TeamCard } from "@/components/team/TeamCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const ROW = "flex min-h-14 items-center gap-4 px-5 py-3 text-sm sm:px-6";

const METHOD: Record<string, string> = {
  phone_match: "your phone was the one on the listing",
  phone_code: "a code sent to the listing's phone",
  review: "Mesita reviewed your request",
};

// The place's settings only: Place (with Leave) and Team (MESITA-3171, Pato: "use standard names for the boxes. short"), as
// cards of rows like Billing and Premier (MESITA-3196). The header already says the place's name and "Mesita
// staff". Your email and sign-out live in Account alone (MESITA-3154). The
// waiter code left for Payments › Cash Payments and Actions (Reservations)
// for its own Reservations page (MESITA-3600).
export default async function PlaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">Place</h2>
        <ul className="divide-border divide-y">
          <li className={ROW}>
            <span className="text-muted-foreground w-20 shrink-0">Visibility</span>
            <span>{manage.place.listed === false ? "Hidden from guests by Mesita" : "Visible to guests"}</span>
          </li>
          {manage.manager ? (
            <li className={ROW}>
              <span className="text-muted-foreground w-20 shrink-0">Your role</span>
              <span className="min-w-0">
                {manage.manager.role === "editor" ? "Editor" : "Owner"}
                <span className="text-muted-foreground"> · because {METHOD[manage.manager.method] ?? "you were verified"}</span>
              </span>
            </li>
          ) : null}
          {manage.role !== "superadmin" ? (
            <li className={ROW}>
              <LeavePlace placeId={id} />
            </li>
          ) : null}
        </ul>
      </Card>
      <TeamCard placeId={id} />
    </div>
  );
}
