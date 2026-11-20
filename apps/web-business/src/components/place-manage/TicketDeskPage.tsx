import { Card } from "@/components/shell/Page";
import { listPlaceTickets } from "@/lib/business-api";
import type { TicketKind } from "@/lib/ticket-desk";
import { TicketDesk } from "./TicketDesk";

/** One Operations ticket page. The server is the door: an editor is told,
 *  a failed read says so, and a real desk never draws zeros in place of data. */
export async function TicketDeskPage({ placeId, kind }: { placeId: string; kind: TicketKind }) {
  const desk = await listPlaceTickets(placeId, kind);
  if (!desk.ok) {
    const owner = desk.code === "owner_only";
    return (
      <div className="flex flex-col gap-4 pb-8">
        <Card>
          <p className="font-semibold">{owner ? "Only the owner sees these tickets." : "These tickets didn't load."}</p>
          <p className="text-muted-foreground mt-1 text-sm">{owner ? "Money at this place is the owner's to read." : desk.error}</p>
        </Card>
      </div>
    );
  }
  return <TicketDesk placeId={placeId} kind={kind} initial={desk.data} />;
}
