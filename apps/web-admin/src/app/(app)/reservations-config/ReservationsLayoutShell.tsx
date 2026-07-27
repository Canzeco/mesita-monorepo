"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { RESERVATIONS_SUBROUTES } from "./nav";

// Reservations Config shell — header + the Config/Playground tab strip. Mirrors
// the Enricher / Lineup config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/reservations-config/config":
    "The Reservationist is a voice agent, not a form: a Supabase function briefs an ElevenLabs agent and it phones the venue over Twilio. Tune the number it dials while testing, how hard it retries, and the channel it books through.",
  "/reservations-config/playground":
    "Emulate a reservation as a fake user: pick a real place and consumer from the database, author the intent, choose test or actual numbers on both sides, and place the call. Tickets stay in the playground sandbox.",
};

export function ReservationsLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const match = RESERVATIONS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/reservations-config/config"];

  return (
    <>
      <PageHeader
        eyebrow="Operations · Reservations"
        title="Reservations Config"
        description={description}
      />
      <ConfigTabNav
        ariaLabel="Reservations Config"
        subroutes={RESERVATIONS_SUBROUTES}
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
