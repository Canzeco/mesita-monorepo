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
      <ShellPlaceName
        id={id}
        name={manage.place.name ?? null}
        photo={manage.place.profile_photo ?? manage.place.photos?.[0] ?? null}
        connectStripe={manage.canSell === false}
      />
      {/* Mesita is filling in the profile (MESITA-3140). */}
      <PlaceTabTitle right={enrichmentView(manage.place).enriching ? <EnrichingTag /> : null} />
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PreviewButton />
        <PlaceScroll staff={manage.role === "superadmin"}>{children}</PlaceScroll>
      </div>
    </PlaceManageShell>
  );
}
