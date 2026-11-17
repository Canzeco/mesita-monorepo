"use client";

import { useParams } from "next/navigation";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { TicketSkeleton } from "@/components/consumer/activity/TicketParts";
import { creditEntryTitle } from "@/lib/credit-entry-title";

// The page's own frame while its read is out (MESITA-2701), under the same
// header the page will wear (MESITA-4258).
export default function Loading() {
  const params = useParams<{ entry?: string }>();
  return (
    <MeScreen title={creditEntryTitle(params?.entry)}>
      <TicketSkeleton />
    </MeScreen>
  );
}
