"use client";

import { useState } from "react";
import { Heart, Phone, Share2 } from "lucide-react";

import { sharePlace } from "@/lib/share-place";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import type { PlaceDetail } from "@/lib/place-detail";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Save · Contact · Share — three equal outline buttons. Save toggles the
// localStorage favorite (saved state = primary tint + filled heart); Share
// hands off to sharePlace (OS sheet, or clipboard + toast). Contact glyph
// prefers WhatsApp when the place has it.
//
// RESERVE LEFT THIS ROW (MESITA-1065) for the fixed bar at the bottom of the
// surface. What's left here are the verbs that act on your relationship to the
// PAGE — keep it, call it, pass it on — and all three are reversible. Reserve
// commits you to being at the place, which is the other bar's job.
export function ProfileActions({
  place,
  className,
}: {
  place: PlaceDetail;
  className?: string;
}) {
  const { isSaved, toggle } = useSavedPlaces();
  const [contactOpen, setContactOpen] = useState(false);
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = isSaved(place.id);

  // gap-1 + whitespace-nowrap keeps every label on one line; at 3-up there is
  // more room than the old 4-up row ever had.
  const outlineBtn =
    "border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center gap-1 rounded-xl border py-2.5 type-body font-semibold whitespace-nowrap transition active:scale-[0.99]";

  function onSave() {
    const nowSaved = !saved;
    toggle(place.id);
    if (nowSaved) {
      toast.success(`Saved ${place.name}`);
    } else {
      toast(`Removed ${place.name} from saved`);
    }
  }

  return (
    <>
      <div className={cn("grid grid-cols-3 gap-2", className)}>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save place"}
          className={cn(
            outlineBtn,
            // Saved reads RED, not brand pink — the universal "hearted" hue
            // (MESITA-587), unmistakable at a glance next to its siblings.
            //
            // SOLID, not a tint (Pato, live 2026-08-17: "different background
            // color when saved, the save button looks like shit"). The old
            // `bg-destructive/12` was a 12% wash on a WHITE band sitting directly
            // above the pink tab body — at that opacity it landed in the same
            // pale-pink family as the page itself, so it read as a smudge
            // rather than a state, and the thin /50 border was doing all the
            // work. A toggle's ON state should be the loudest thing in its
            // row: solid fill, white label, white filled heart.
            saved &&
              "shadow-danger border-destructive bg-destructive text-white hover:border-destructive hover:bg-destructive",
          )}
        >
          <Heart
            className={cn("h-4 w-4 shrink-0", saved && "fill-current")}
            strokeWidth={2.25}
          />
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={contactOpen}
          className={outlineBtn}
        >
          {hasWhatsApp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/channels/whatsapp.svg"
              alt=""
              aria-hidden
              className="h-4 w-4 shrink-0"
            />
          ) : (
            <Phone className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          )}
          Contact
        </button>
        {/* Share is the same verb Scroll's card offers (MESITA-1697), so
            the two surfaces never disagree one tap apart. */}
        <button
          type="button"
          onClick={() => void sharePlace(place)}
          className={outlineBtn}
        >
          <Share2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Share
        </button>
      </div>
      <PlaceContactSheet
        place={place}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </>
  );
}
