import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PLACE_TAB_META } from "@/components/shell/place-tab-meta";
import { getManagePlace } from "@/lib/place-view";
import { placeTabHref, type PlaceTab } from "@/lib/routes";
import { FOCUS_RING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "General" };

// General (MESITA-4528, Pato: "General (here include reservations and stories
// and missing configuration, easy peasy, and the all there nested with a new
// button)"): the pages the rail no longer lists, as one card of rows, and a
// button to All. Admin shows for Mesita staff only; its page 404s for anyone
// else, so hiding the row is never the gate.
const ROWS: readonly PlaceTab[] = ["reservations", "stories", "money", "settings"];

export default async function GeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  const rows: PlaceTab[] = manage?.role === "superadmin" ? [...ROWS, "admin"] : [...ROWS];
  return (
    <div className="flex flex-col gap-4 pb-8">
      <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
        {rows.map((tab) => {
          const { label, icon: Mark, sub } = PLACE_TAB_META[tab];
          return (
            <li key={tab}>
              <Link
                href={placeTabHref(id, tab)}
                className={cn("hover:bg-muted/50 flex items-center gap-3 px-4 py-3.5 transition", FOCUS_RING_CLASS)}
              >
                <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl">
                  <Mark size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="text-muted-foreground block text-sm">{sub}</span>
                </span>
                <CaretRightIcon size={16} className="text-muted-foreground shrink-0" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
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
