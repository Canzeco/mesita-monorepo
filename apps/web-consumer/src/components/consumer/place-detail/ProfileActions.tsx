"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Heart, Phone, Share2 } from "lucide-react";

import { ComingSoonModal } from "@/components/consumer/ComingSoonModal";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/mock/place";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Save · Contact · Reserve · Share — four equal outline buttons. Save toggles
// the localStorage favorite (saved state = primary tint + filled heart).
// Reserve + Share are parked: tap opens ComingSoonModal (no "Soon" pills).
// Contact glyph prefers WhatsApp when the place has it.
export function ProfileActions({
  place,
  className,
}: {
  place: PlaceDetail;
  className?: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedPlaces();
  const [contactOpen, setContactOpen] = useState(false);
  const [soonKind, setSoonKind] = useState<"reserve" | "share" | null>(null);
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = isSaved(place.id);

  // gap-1 + whitespace-nowrap keeps all four labels on one line at 4-up.
  const outlineBtn =
    "border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center gap-1 rounded-xl border py-2.5 text-[13px] font-semibold whitespace-nowrap transition active:scale-[0.99]";

  function onSave() {
    const nowSaved = !saved;
    toggle(place.id);
    if (nowSaved) {
      toast.action(
        `Saved ${place.name}`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.favorites),
        },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${place.name} from saved`);
    }
  }

  return (
    <>
      <div className={cn("grid grid-cols-4 gap-2", className)}>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save place"}
          className={cn(
            outlineBtn,
            // Saved reads RED, not brand pink — the universal "hearted" hue
            // (MESITA-587), unmistakable at a glance next to its siblings.
            saved &&
              "border-red-500/50 bg-red-500/12 text-red-600 hover:bg-red-500/18",
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
        <button
          type="button"
          onClick={() => setSoonKind("reserve")}
          className={outlineBtn}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Reserve
        </button>
        <button
          type="button"
          onClick={() => setSoonKind("share")}
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
      <ComingSoonModal
        open={soonKind === "reserve"}
        onClose={() => setSoonKind(null)}
        title="Reservations coming soon"
        body="Book a table from Mesita shortly — for now, use Contact to reach the place."
        icon={CalendarCheck}
      />
      <ComingSoonModal
        open={soonKind === "share"}
        onClose={() => setSoonKind(null)}
        title="Sharing coming soon"
        body="You'll be able to share this place with friends from here soon."
        icon={Share2}
      />
    </>
  );
}
