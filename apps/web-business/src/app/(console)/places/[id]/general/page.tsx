import Link from "next/link";
import { PLACE_TAB_META } from "@/components/shell/place-tab-meta";
import { listMonitor } from "@/lib/business-api";
import { customerParam, uuidParam } from "@/lib/monitor";
import { MonitorError, MonitorList } from "@/components/place-manage/MonitorList";
import { ScrollToStories } from "./ScrollToStories";
import { placeTabHref, type PlaceTab } from "@/lib/routes";
import { FOCUS_RING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { ReservationsPanel } from "../reservations/ReservationsPanel";
import { SettingsSection } from "../settings/SettingsSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "General" };

// General (MESITA-4528) is ONE page of sections (MESITA-4534, Pato: "don't
// create subpages in general btw — all there displayed in the same page but
// in different sections"): Reservations, Stories, Settings, then a
// button to All. Admin is its own rail row for Mesita staff (Pato: "admin
// must be its own page"). Each section's id is its old
// address's tab, so /places/<id>/<tab> redirects to #<tab> here. Money left for
// Monitor › Payments and Stories is a plain linked list (MESITA-4538); a
// story link lands here with ?story= or ?story_customer=.
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

export default async function GeneralPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = { id: uuidParam(sp.story), customer: customerParam(sp.story_customer) };
  const stories = await listMonitor(id, "stories", filter);
  const filtered = Boolean(filter.id || filter.customer);
  return (
    <div className="flex flex-col gap-8 pb-8">
      <Section tab="reservations">
        <ReservationsPanel />
      </Section>
      <Section tab="stories">
        {filtered ? <ScrollToStories /> : null}
        {stories.ok ? (
          <div className="border-border bg-card overflow-hidden rounded-2xl border">
            <MonitorList
              key={`${filter.id ?? ""}|${filter.customer ?? ""}`}
              placeId={id}
              kind="stories"
              initial={stories.data}
              filter={filter}
              clearHref={`/places/${encodeURIComponent(id)}/general#stories`}
            />
          </div>
        ) : (
          <MonitorError code={stories.code} error={stories.error} />
        )}
      </Section>
      <Section tab="settings">
        <SettingsSection id={id} />
      </Section>
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
