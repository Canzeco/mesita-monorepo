// One row in either places list, plus its action. Claim and release are
// the same shape from the user's side — a row and one button — so they
// share PlaceHoldButton and cannot drift apart visually.
//
// The row opens Place (the manage surface) from BOTH lists: reading an
// address you are about to claim is exactly as reasonable as reading one
// you already hold, and business-web-get-place answers for both.
//
// Open is an explicit BUTTON, not just the linked name. The name alone
// underlined on hover, which is no affordance at all — a row whose only
// visible control was Release read as a row you could only give away.
//
// And on a place you already hold, Open takes the solid pill: managing it
// is the obvious move, releasing it is the escape hatch. On the pool list
// Claim owns the fill and Open steps back to the ghost.
//
// THE ROW SHOWS THE PLACE (MESITA-1562): photo · name · org · states.
// Three rules keep it calm at 100 rows, which is the console's whole brief:
//
//   1. The thumb goes through placeThumbUrl(). places.photos holds
//      full-resolution originals; pointing an <img> at one 100 times is
//      ~27MB of scroll (MESITA-1553).
//   2. A chip renders only when it SAYS something. Listed is always shown
//      because it is the visibility fact; every other chip appears only
//      when true, so a plain unenriched pool row stays a plain row instead
//      of wearing eight grey "No" badges.
//   3. Nothing here invents vocabulary. Every chip is a column or a shared
//      helper's answer — there is no "Adopted", and no "Visits enabled",
//      because neither exists in the schema.
import Link from "next/link";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { placeHref, withOrg } from "@/lib/console-routes";
import { placeThumbUrl } from "@/lib/place-thumb";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ConsolePlace } from "@/lib/api/organizations";

/** The rendered thumb box, in CSS pixels. Also what placeThumbUrl doubles
 *  for the retina request. */
const THUMB_PX = 44;

/** Google's operational fact is worth a chip only when it is BAD news.
 *  "OPERATIONAL" on every row would be noise, and null is silence — not a
 *  claim that the place is closed. */
function closedLabel(businessState: string | null | undefined): string | null {
  if (typeof businessState !== "string") return null;
  const v = businessState.trim();
  if (v === "" || v.toUpperCase() === "OPERATIONAL") return null;
  const words = v.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "on" | "neutral" | "off" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        tone === "warn"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {tone === "on" || tone === "off" ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "on" ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

function PlaceThumb({ place }: { place: ConsolePlace }) {
  const src = placeThumbUrl(place.photoUrl, THUMB_PX);
  if (src) {
    // Plain <img>, the same choice PlaceGallery makes: placeThumbUrl has
    // already produced a 2x thumb of a few KB, so next/image would add a
    // second optimizer pass (and its per-image cost) over a file that is
    // smaller than the request to re-encode it.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={THUMB_PX}
        height={THUMB_PX}
        loading="lazy"
        decoding="async"
        className="border-border/60 h-11 w-11 shrink-0 rounded-lg border object-cover"
      />
    );
  }
  // No photo is the ordinary case, not an error: several live places are
  // not enriched yet. The initial reads as a placeholder without pretending
  // to be a photograph.
  return (
    <span
      aria-hidden
      className="border-border/60 bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold"
    >
      {place.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function PlaceStateChips({ place }: { place: ConsolePlace }) {
  const chips: React.ReactNode[] = [];

  // The visibility fact, always — its absence is the thing an operator most
  // needs to see on a list.
  chips.push(
    <Chip key="listed" tone={place.listed ? "on" : "off"}>
      {place.listed ? "Listed" : "Not listed"}
    </Chip>,
  );

  const closed = closedLabel(place.businessState);
  if (closed) chips.push(<Chip key="closed" tone="warn">{closed}</Chip>);

  // Requested is a COUNT, never Yes/No (MESITA-1372), and 0 says nothing.
  const requests = place.requestCount ?? 0;
  if (requests > 0) {
    chips.push(<Chip key="requested" tone="on">{`Requested ${requests}`}</Chip>);
  }

  // Intake, as outcome AND meter. They are different facts and the live data
  // shows them disagreeing: Cabaret Social Room carries enriched_at with a
  // high-water of 3, Hemingway Bar with 8. Enriched means Intaker stamped
  // enriched_at; the meter is how far the ten-function queue actually got. A
  // row that showed only "Enriched" would hide a half-filled profile, which
  // is exactly the thing an operator is scanning the list for.
  if (place.enriched) {
    chips.push(<Chip key="enriched" tone="on">Enriched</Chip>);
  } else if (place.enriching) {
    chips.push(<Chip key="enriching" tone="on">Enriching</Chip>);
  }
  if (typeof place.intakeTotal === "number" && place.intakeTotal > 0) {
    chips.push(
      <Chip key="intake">{`Intake ${place.intakePulse ?? 0}/${place.intakeTotal}`}</Chip>,
    );
  }

  // The commercial rails, on only. These are the columns that exist —
  // orders_enabled is the umbrella, pickup/delivery are their own flags.
  const rails: [boolean | undefined, string][] = [
    [place.orders, "Orders"],
    [place.pickupOrders, "Pickup"],
    [place.deliveryOrders, "Delivery"],
    [place.reservations, "Reservations"],
    [place.mesitaPay, "Mesita Pay"],
    [place.credits, "Credits"],
  ];
  for (const [on, label] of rails) {
    if (on) chips.push(<Chip key={label} tone="on">{label}</Chip>);
  }

  return <div className="mt-1.5 flex flex-wrap items-center gap-1">{chips}</div>;
}

export function PlaceRow({
  place,
  action,
  organizationId,
  allowed,
}: {
  place: ConsolePlace;
  action: "claim" | "release";
  organizationId: string;
  allowed: boolean;
}) {
  const href = withOrg(placeHref(place.id), organizationId);

  return (
    <div className="border-border/60 flex items-start justify-between gap-3 border-b py-3.5 last:border-b-0">
      <div className="flex min-w-0 gap-3">
        <PlaceThumb place={place} />
        <div className="min-w-0">
          <Link href={href} className="truncate text-sm font-semibold hover:underline">
            {place.name}
          </Link>
          <p className="text-muted-foreground truncate text-[12px]">
            {place.address ?? place.zone ?? "No address"}
          </p>
          {/* The org is IDENTITY here, never a state. An organization's own
              state is about money; Listed and Verified describe one address
              and live on the place. A pooled place is held by nobody. */}
          <p className="text-muted-foreground truncate text-[12px]">
            {place.organizationName ?? "No organization"}
          </p>
          <PlaceStateChips place={place} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={href}
          className={action === "release" ? PILL_BUTTON_CLASS : GHOST_PILL_BUTTON_CLASS}
        >
          Open
        </Link>
        <PlaceHoldButton
          action={action}
          placeId={place.id}
          organizationId={organizationId}
          allowed={allowed}
        />
      </div>
    </div>
  );
}
