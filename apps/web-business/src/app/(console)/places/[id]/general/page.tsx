import Link from "next/link";
import { PLACE_TAB_META } from "@/components/shell/place-tab-meta";
import { TicketDeskPage } from "@/components/place-manage/TicketDeskPage";
import { getManagePlace } from "@/lib/place-view";
import { placeTabHref, type PlaceTab } from "@/lib/routes";
import { FOCUS_RING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { ReservationsPanel } from "../reservations/ReservationsPanel";
import { MoneySection } from "../money/MoneySection";
import { SettingsSection } from "../settings/SettingsSection";
import { AdminSection } from "../admin/AdminSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "General" };

// General (MESITA-4528) is ONE page of sections (MESITA-4534, Pato: "don't
// create subpages in general btw — all there displayed in the same page but
// in different sections"): Reservations, Stories, Money, Settings, and Admin
// for Mesita staff, then a button to All. Each section's id is its old
// address's tab, so /places/<id>/<tab> redirects to #<tab> here. Admin draws
// nothing for anyone but staff; its writes are refused at the EF anyway.
function Section({ tab, children }: { tab: PlaceTab; children: React.ReactNode }) {
  const { label, icon: Mark, sub } = PLACE_TAB_META[tab];
  return (
    <section id={tab} aria-labelledby={`${tab}-title`} className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl">
          <Mark size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`${tab}-title`} className="font-semibold">
            {label}
          </h2>
          <p className="text-muted-foreground text-sm">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function GeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  return (
    <div className="flex flex-col gap-8 pb-8">
      <Section tab="reservations">
        <ReservationsPanel />
      </Section>
      <Section tab="stories">
        <TicketDeskPage placeId={id} kind="stories" />
      </Section>
      <Section tab="money">
        <MoneySection id={id} />
      </Section>
      <Section tab="settings">
        <SettingsSection id={id} />
      </Section>
      {manage?.role === "superadmin" ? (
        <Section tab="admin">
          <AdminSection id={id} />
        </Section>
      ) : null}
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
