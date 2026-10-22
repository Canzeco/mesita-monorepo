"use client";

import { usePathname } from "next/navigation";
import { PlaceProfileSkeleton } from "@mesita/place-profile";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { placeTabFromPathname } from "@/lib/place-tabs";

// ONE TAB'S BODY WHILE IT LOADS, AT ITS SIZES (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the sizes").
// This boundary draws INSIDE this folder's layout.tsx (a loading.tsx never
// wraps its own segment's layout), so the heading, the strip of doors
// (PlaceTabStrip) and PlaceScroll are already the real ones above it, and
// so is PlaceManageShell's PlaceProvider: the place is already in hand, and
// the Preview silhouette reads it the way PlacePreview does. It stands in
// only for the tab the operator opened, under them:
//   Profile — nothing. PlaceScroll keeps the editor mounted and on screen;
//             anything here would draw under it and then vanish.
//   Reviews — ReviewsSummary: its header, then the four summary cards.
//   Preview — PlacePreview: its notes, the member phone, the place screen's
//             own silhouette inside (the package's PlaceProfileSkeleton).
//   Admin   — AdminSection: the six cards in its columns, the three
//             disclosures OPEN as they mount.
// Until MESITA-2701 it drew a second heading and strip, a slab and two
// cards, under the real ones. A client file because the tab is the URL's.

const BONE = "bg-muted animate-pulse rounded-lg";
const CARD =
  "border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6";

function Bone({ className }: { className: string }) {
  return <div aria-hidden className={`${BONE} ${className}`} />;
}

export default function AdminPlaceTabLoading() {
  const tab = placeTabFromPathname(usePathname() ?? "");
  if (tab === "reviews") return <ReviewsTabSkeleton />;
  if (tab === "preview") return <PreviewTabSkeleton />;
  if (tab === "admin") return <AdminTabSkeleton />;
  return null;
}

/** SectionCard's head (admin-ui/manage): the 36px tinted chip, the 16px
 *  title on its 24px line, the 12px subtitle, the state at the right. */
function CardHead({
  title,
  subtitle = false,
  state = false,
}: {
  title: string;
  subtitle?: boolean;
  state?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Bone className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <div className="font-display flex h-[1lh] items-center text-base">
            <Bone className={`h-4 ${title}`} />
          </div>
          {subtitle ? (
            <div className="mt-0.5 flex h-[1lh] items-center text-xs leading-relaxed">
              <Bone className="h-3 w-48" />
            </div>
          ) : null}
        </div>
      </div>
      {state ? (
        <div className="type-label flex h-[1lh] shrink-0 items-center">
          <Bone className="h-2.5 w-14" />
        </div>
      ) : null}
    </div>
  );
}

function ReviewsTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <span className="sr-only">Loading place</span>
      <header aria-hidden className="flex flex-wrap items-start justify-between gap-3">
        <CardHead title="w-20" subtitle />
        {/* Sync: h-10, px-4, the 14px glyph, 8px, "Sync" (86px). */}
        <Bone className="h-10 w-[86px] rounded-full" />
      </header>
      {/* Google Summary · Instagram Summary · Facebook Summary · Google
          Reviews: each a SectionCard with its 24px number line. */}
      {["w-36", "w-40", "w-40", "w-32"].map((title, i) => (
        <section key={i} aria-hidden className={CARD}>
          <CardHead title={title} subtitle state />
          <div className="mt-5 flex h-6 items-center">
            <Bone className="h-6 w-16" />
          </div>
        </section>
      ))}
    </div>
  );
}

/** PlacePreview's column: the notes it prints above the phone (not enriched
 *  yet, unsaved edits), each one 14px line, read from the same place
 *  context; then MemberPhone's frame (the consumer's tokens, member-phone)
 *  with the place screen's silhouette inside, read from the package. */
function PreviewTabSkeleton() {
  const { place, isDirty } = usePlaceContext();
  const enriched =
    place.enriched === true ||
    (typeof place.enriched_at === "string" && place.enriched_at.trim() !== "");
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {enriched ? null : (
        <div className="flex h-[1lh] shrink-0 items-center text-sm">
          <Bone className="h-3.5 w-72 max-w-full" />
        </div>
      )}
      {isDirty ? (
        <div className="flex h-[1lh] shrink-0 items-center text-sm">
          <Bone className="h-3.5 w-[31rem] max-w-full" />
        </div>
      ) : null}
      <div className="member-phone border-border mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden border md:rounded-3xl md:shadow-elev">
        <PlaceProfileSkeleton />
      </div>
    </div>
  );
}

/** StateCard's row: the 13px name on the card's 24px line (an inline span
 *  in a block, so the 16px body's line sets the row), the 11px detail
 *  (`lines` of it: the long ones wrap in a three-column card), the chip at
 *  the right. Disabled carries its Disable button under the detail. */
function StateRowSkeleton({
  lines = 1,
  action = false,
}: {
  lines?: 1 | 2;
  action?: boolean;
}) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex h-[1lh] items-center">
          <Bone className="h-3 w-20" />
        </div>
        <div className="type-label mt-1 flex flex-col">
          <div className="flex h-[1lh] items-center">
            <Bone className="h-2.5 w-full max-w-60" />
          </div>
          {lines === 2 ? (
            <div className="flex h-[1lh] items-center">
              <Bone className="h-2.5 w-2/5" />
            </div>
          ) : null}
        </div>
        {action ? <Bone className="mt-2.5 h-9 w-20 rounded-full" /> : null}
      </div>
      <Bone className="h-6 w-12 shrink-0 rounded-full" />
    </div>
  );
}

/** ReadField boxed (admin-ui/manage): the 13px label line, 6px, then the
 *  filled box, 40px at least; `box` is its height for the content these
 *  cards usually hold. */
function ReadFieldSkeleton({ label, box = "h-10" }: { label: string; box?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="type-body flex h-[1lh] items-center">
        <Bone className={`h-3 ${label}`} />
      </div>
      <Bone className={`${box} rounded-xl`} />
    </div>
  );
}

/** The three `<details open>` cards (SERP Summary, Vectors, Metadata): the
 *  summary row (36px chip, 16px title, the 12px subtitle on ITS line height,
 *  the chevron), then under a hairline the open body of ReadFields. */
function DisclosureSkeleton({
  title,
  subtitle,
  body,
  fields,
}: {
  title: string;
  /** The subtitle's own type: `text-xs` (16px line) or with
   *  `leading-relaxed` (19.5px). */
  subtitle: string;
  /** The body's padding, as the card writes it. */
  body: string;
  fields: { label: string; box?: string }[];
}) {
  return (
    <section
      aria-hidden
      className="border-border bg-card shadow-card rounded-2xl border"
    >
      <div className="flex items-center gap-3 p-5 sm:p-6">
        <Bone className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="font-display flex h-[1lh] items-center text-base">
            <Bone className={`h-4 ${title}`} />
          </div>
          <div className={`mt-0.5 flex h-[1lh] items-center ${subtitle}`}>
            <Bone className="h-3 w-48 max-w-full" />
          </div>
        </div>
        <Bone className="h-4 w-4 shrink-0" />
      </div>
      <div className={`border-border/60 flex flex-col gap-4 border-t ${body}`}>
        {fields.map((f) => (
          <ReadFieldSkeleton key={f.label + (f.box ?? "")} label={f.label} box={f.box} />
        ))}
      </div>
    </section>
  );
}

function AdminTabSkeleton() {
  return (
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 xl:columns-3">
      <span className="sr-only">Loading place</span>
      {/* Profile States: Created · Pulsing · Requested · Enriching ·
          Enriched · Selected · Disabled. The long details wrap. */}
      <section aria-hidden className={CARD}>
        <CardHead title="w-28" />
        <div className="mt-5 flex flex-col">
          <StateRowSkeleton lines={2} />
          <StateRowSkeleton lines={2} />
          <StateRowSkeleton />
          <StateRowSkeleton />
          <StateRowSkeleton />
          <StateRowSkeleton lines={2} />
          <StateRowSkeleton lines={2} action />
        </div>
      </section>
      {/* Reviews States: Google Found. */}
      <section aria-hidden className={CARD}>
        <CardHead title="w-32" />
        <div className="mt-5 flex flex-col">
          <StateRowSkeleton />
        </div>
      </section>
      {/* Enrichment opens on its own spinner (py-10, one 14px line). */}
      <section aria-hidden className={CARD}>
        <CardHead title="w-24" />
        <div className="mt-5 flex items-center gap-2 py-10 text-sm">
          <div className="flex h-[1lh] items-center gap-2">
            <Bone className="h-4 w-4 rounded-full" />
            <Bone className="h-3 w-16" />
          </div>
        </div>
      </section>
      {/* SERP Summary: one field, "Loading…" in its box as it mounts. */}
      <DisclosureSkeleton
        title="w-28"
        subtitle="text-xs"
        body="px-5 pb-6 sm:px-6 sm:pb-8"
        fields={[{ label: "w-24" }]}
      />
      {/* Vectors: Mesita Name (name over its note), the Semantic Summary's
          paragraph, the two vector previews, Model, Source hashes. */}
      <DisclosureSkeleton
        title="w-20"
        subtitle="text-xs"
        body="px-5 pb-6 sm:px-6 sm:pb-8"
        fields={[
          { label: "w-20", box: "h-11" },
          { label: "w-44", box: "h-24" },
          { label: "w-20", box: "h-14" },
          { label: "w-24", box: "h-14" },
          { label: "w-10" },
          { label: "w-24", box: "h-24" },
        ]}
      />
      {/* Metadata: UID, Created at, Updated at. */}
      <DisclosureSkeleton
        title="w-20"
        subtitle="text-xs leading-relaxed"
        body="px-5 pb-5 sm:px-6 sm:pb-6"
        fields={[{ label: "w-8" }, { label: "w-16" }, { label: "w-[4.5rem]" }]}
      />
    </div>
  );
}
