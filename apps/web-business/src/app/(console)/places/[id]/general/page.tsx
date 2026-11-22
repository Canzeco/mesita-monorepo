import Link from "next/link";
import { PLACE_TAB_META } from "@/components/shell/place-tab-meta";
import { placeTabHref } from "@/lib/routes";
import { FOCUS_RING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { ReservationsPanel } from "../reservations/ReservationsPanel";
import { SettingsSection } from "../settings/SettingsSection";
import { ReportsCard } from "./ReportsCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "General" };

// General (MESITA-4528): the place's configuration on one page (MESITA-4534).
// Plain cards, no lists and no section headings (MESITA-4553, Pato: "no
// fucking logs nor weird sections in general"): Reservations, Place, Team,
// Reports (Soon, MESITA-4686), then a button to All. Each card keeps its old address as an anchor
// (#reservations, #settings), where /places/<id>/<tab> redirects.
export default async function GeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <div id="reservations" className="flex scroll-mt-4 flex-col gap-4">
        <ReservationsPanel />
      </div>
      <div id="settings" className="flex scroll-mt-4 flex-col gap-4">
        <SettingsSection id={id} />
      </div>
      <ReportsCard />
      <Link
        href={placeTabHref(id, "all")}
        className={cn(
          "border-border bg-card hover:bg-muted/60 inline-flex h-10 items-center gap-2 self-start rounded-lg border px-4 text-sm font-medium transition-colors",
          FOCUS_RING_CLASS,
        )}
      >
        <PLACE_TAB_META.all.icon size={18} aria-hidden />
        All products
      </Link>
    </div>
  );
}
