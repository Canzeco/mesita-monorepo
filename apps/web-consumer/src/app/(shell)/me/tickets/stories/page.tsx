import { TicketsPage } from "@/components/consumer/activity/MeLists";

// /me/tickets/stories — Tickets with the Stories chip picked, the same page
// as /me/tickets/[kind] (MESITA-3855). Its own folder since one story's
// ticket lives under it (MESITA-4747), so the route map names it as the
// ticket's Back.
export default function Page() {
  return <TicketsPage />;
}
