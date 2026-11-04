// One place in the Business app (MESITA-3103). This file is the seam: it
// asks the server for the place ONCE (business-web-get-place, which lets in
// whoever runs the place and Mesita staff, and 404s everyone else), mounts
// the editor's shell, and names the place in the side menu. The side menu is
// the place's only navigation (MESITA-3136: no tab row); Profile carries
// the Preview button.
import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { PlaceManageShell } from "@/components/place-manage/PlaceManageShell";
import { PlaceScroll } from "@/components/place-manage/PlaceScroll";
import { PlaceTabTitle } from "@/components/shell/PlaceTabTitle";
import { PreviewButton } from "@/components/place-manage/PreviewButton";
import { ShellPlaceName } from "@/lib/shell-place";
import { EnrichingTag } from "@/components/place-manage/GenerateSteps";
import { enrichmentView } from "@/lib/place-enriched";

export const dynamic = "force-dynamic";

export default async function PlaceLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();

  return (
    <PlaceManageShell placeId={id} initialPlace={manage.place} initialProfile={manage.profile}>
      <ShellPlaceName id={id} name={manage.place.name ?? null} photo={manage.place.photos?.[0] ?? null} />
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 title={manage.place.name} className="min-w-0 truncate font-sans text-xl font-semibold tracking-tight sm:text-2xl">
              {manage.place.name}
            </h1>
            {/* Mesita is filling in the profile (MESITA-3140). */}
            {enrichmentView(manage.place).enriching ? <EnrichingTag /> : null}
            {manage.role === "superadmin" ? (
              <span className="border-border bg-card type-label rounded-full border px-2.5 py-0.5 font-semibold">Mesita staff</span>
            ) : null}
          </div>
          <PlaceTabTitle />
          <PreviewButton />
        </div>
        <PlaceScroll staff={manage.role === "superadmin"}>{children}</PlaceScroll>
      </div>
    </PlaceManageShell>
  );
}
