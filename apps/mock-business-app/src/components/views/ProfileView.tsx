"use client";

// Profile — the place's public page, and the only view a POOL place has.
//
// Always free, on every place, partner or not. It is also the only view that
// renders for a place the caller holds no membership on, and there it is
// READ-ONLY: a claim is what mints the owner row, so until then there is
// nothing to save against.
import { usePlaceScope } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Tiles } from "@/components/shared/Tiles";
import { Badge } from "@/components/shared/Badges";
import {
  CTA_BUTTON_CLASS,
  FORM_COLUMN_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium">{label}</span>
      {/* Read-only on purpose. A mock that accepted edits would owe a save, and
          a Save that does nothing is the one lie a harness must not tell. */}
      <input className={INPUT_CLASS} defaultValue={value} readOnly />
      {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
    </label>
  );
}

export function ProfileView() {
  const { place, pool } = usePlaceScope();

  if (!place && pool) {
    return (
      <div className="flex flex-col gap-4">
        <Section
          title="Nobody holds this place"
          description="Mesita knows it is real. Until somebody claims it, there is no owner to edit it and no manage surface under it."
          right={<button type="button" className={PILL_BUTTON_CLASS}>Claim</button>}
          lane
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className={TINY_LABEL_CLASS}>Category</dt>
              <dd className="text-sm">{pool.category}</dd>
            </div>
            <div>
              <dt className={TINY_LABEL_CLASS}>City</dt>
              <dd className="text-sm">{pool.city}</dd>
            </div>
          </dl>
        </Section>
      </div>
    );
  }

  if (!place) return null;

  const readOnly = place.myRole === "viewer";

  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Rating", value: place.rating.toFixed(1), hint: `${place.reviewCount} reviews` },
          { label: "Photos", value: place.photoCount },
          { label: "Menus", value: place.menuCount },
          { label: "Completeness", value: `${completeness(place)}%`, hint: "Of the fields guests see" },
        ]}
      />

      <Section
        title="The public page"
        description="What a guest sees when they open this place in the Mesita app."
        right={
          readOnly ? (
            <Badge>Read-only</Badge>
          ) : (
            <button type="button" className={PILL_BUTTON_CLASS}>Save</button>
          )
        }
        lane
      >
        <div className={FORM_COLUMN_CLASS}>
          <Field label="Name" value={place.name} />
          <Field label="Category" value={place.category} />
          <Field label="Street" value={place.street} />
          <Field label="City" value={place.city} />
          <Field label="Phone" value={place.phone} />
          <Field
            label="Website"
            value={place.website}
            hint="Shown as a link on the public page."
          />
        </div>
      </Section>

      <Section
        title="Photos"
        description="The first one is the cover. It is the picture the rail and the catalogue wear."
        right={!readOnly && <button type="button" className={PILL_BUTTON_CLASS}>Add photos</button>}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: Math.max(place.photoCount, 1) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "bg-muted aspect-square overflow-hidden rounded-xl",
                i === 0 && "ring-primary ring-2",
              )}
            >
              {i === 0 && place.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- a data URI
                <img src={place.photoUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
        {place.photoCount === 0 && (
          <p className="text-muted-foreground text-[12px]">
            No photos yet. A place without one is the hardest kind to pick out of
            a list.
          </p>
        )}
      </Section>

      {!readOnly && (
        <Section
          title="Hours"
          description="Guests are shown open or closed against these, in the place's own timezone."
        >
          <div className="flex flex-wrap gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div key={d} className="border-border rounded-xl border px-3 py-2 text-[12px]">
                <p className="font-semibold">{d}</p>
                <p className="text-muted-foreground tabular-nums">
                  {i === 6 ? "Closed" : "12:00 – 23:00"}
                </p>
              </div>
            ))}
          </div>
          <button type="button" className={cn(CTA_BUTTON_CLASS, "self-start")}>
            Edit hours
          </button>
        </Section>
      )}
    </div>
  );
}

/** A percentage the page can defend: the share of the fields a guest actually
 *  sees that this place has filled. Not a score — a count. */
function completeness(p: { photoCount: number; menuCount: number; website: string; phone: string }): number {
  const checks = [p.photoCount > 0, p.menuCount > 0, p.website !== "", p.phone !== "", true, true];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
