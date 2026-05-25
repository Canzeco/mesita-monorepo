import {
  MapPin,
  Clock,
  Phone,
  Globe,
  Instagram,
  Facebook,
  MessageCircle,
  Music2,
  CalendarCheck,
  Bike,
  Sparkles,
  Twitter,
  Youtube,
  AtSign,
  Mail,
  Star,
} from "lucide-react";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import type { Venue } from "@/lib/api/venues";

// Pure presentation for the venue detail surface. The two callers (full
// page at /venues/[id] and the intercepted modal at @modal/(.)venues/[id])
// each fetch the venue server-side and supply their own dismiss chrome.

export function VenueDetailBody({ venue }: { venue: Venue }) {
  return (
    <>
      {venue.photos.length > 0 ? (
        <ImageCarousel
          photos={venue.photos}
          alt={venue.name}
          aspect="aspect-[4/5]"
        />
      ) : (
        <PhotoPlaceholder name={venue.name} />
      )}

      <div className="flex flex-col gap-5 px-5 py-5">
        <header className="flex flex-col gap-1">
          {(venue.vibe || venue.category) && (
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
              {[venue.vibe, venue.category]
                .filter(Boolean)
                .join(" · ")
                .toLowerCase()}
            </p>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {venue.name}
          </h1>
          {(venue.price_level != null || venue.closes_at) && (
            <p className="text-muted-foreground text-sm">
              {[
                venue.price_level != null
                  ? "$".repeat(venue.price_level)
                  : null,
                venue.closes_at ? `until ${venue.closes_at}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </header>

        {venue.listing_type === "partner" && venue.cashback_percent != null && (
          <div className="bg-pink-gradient shadow-glow flex items-center justify-between rounded-2xl p-4 text-white">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-white/80 uppercase">
                Verified partner
              </p>
              <p className="font-display mt-0.5 text-xl font-semibold">
                {venue.cashback_percent}% cashback on every visit
              </p>
            </div>
            <Sparkles className="h-7 w-7 text-white/80" />
          </div>
        )}

        {venue.pitch && (
          <p className="text-foreground text-base leading-relaxed">
            {venue.pitch}
          </p>
        )}
        {venue.story && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {venue.story}
          </p>
        )}

        <ContactBlock venue={venue} />
        <ChannelsBlock venue={venue} />
        <ReservationsBlock venue={venue} />
        <ReviewsBlock venue={venue} />
      </div>
    </>
  );
}

function ContactBlock({ venue }: { venue: Venue }) {
  const items = [
    venue.address ? { icon: MapPin, label: venue.address } : null,
    venue.closes_at
      ? { icon: Clock, label: `Closes at ${venue.closes_at}` }
      : null,
    venue.phone
      ? { icon: Phone, label: venue.phone, href: `tel:${venue.phone}` }
      : null,
    venue.email
      ? { icon: Mail, label: venue.email, href: `mailto:${venue.email}` }
      : null,
  ].filter(Boolean) as { icon: typeof MapPin; label: string; href?: string }[];

  if (items.length === 0) return null;
  return (
    <section className="border-border bg-card flex flex-col gap-2 rounded-2xl border p-4">
      {items.map(({ icon: Icon, label, href }) => {
        const inner = (
          <span className="flex items-start gap-3 py-1">
            <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-sm">{label}</span>
          </span>
        );
        return href ? (
          <a
            key={label}
            href={href}
            className="text-foreground hover:underline"
          >
            {inner}
          </a>
        ) : (
          <div key={label} className="text-foreground">
            {inner}
          </div>
        );
      })}
    </section>
  );
}

const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe },
  { key: "whatsapp_url", label: "WhatsApp", Icon: MessageCircle },
  { key: "instagram_url", label: "Instagram", Icon: Instagram },
  { key: "tiktok_url", label: "TikTok", Icon: Music2 },
  { key: "facebook_url", label: "Facebook", Icon: Facebook },
  { key: "x_url", label: "X", Icon: Twitter },
  { key: "youtube_url", label: "YouTube", Icon: Youtube },
  { key: "threads_url", label: "Threads", Icon: AtSign },
  { key: "reddit_url", label: "Reddit", Icon: MessageCircle },
] as const;

const RESERVATION_DEFS = [
  { key: "opentable_url", label: "OpenTable", Icon: CalendarCheck },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck },
  { key: "uber_eats_url", label: "Uber Eats", Icon: Bike },
  { key: "rappi_url", label: "Rappi", Icon: Bike },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike },
] as const;

// Review/discover surfaces. Kept separate from socials so consumers can scan
// "where can I read about this place" at a glance.
const REVIEW_DEFS = [
  { key: "tripadvisor_url", label: "TripAdvisor", Icon: Star },
  { key: "google_maps_url", label: "Google Maps", Icon: MapPin },
] as const;

function ChannelsBlock({ venue }: { venue: Venue }) {
  const active = CHANNEL_DEFS.filter((c) => !!venue[c.key]);
  if (active.length === 0) return null;
  return <ChipGrid title="Channels" items={active} venue={venue} />;
}

function ReservationsBlock({ venue }: { venue: Venue }) {
  const active = RESERVATION_DEFS.filter((c) => !!venue[c.key]);
  if (active.length === 0) return null;
  return <ChipGrid title="Reserve & order" items={active} venue={venue} />;
}

function ReviewsBlock({ venue }: { venue: Venue }) {
  const active = REVIEW_DEFS.filter((c) => !!venue[c.key]);
  if (active.length === 0) return null;
  return <ChipGrid title="Reviews & maps" items={active} venue={venue} />;
}

function ChipGrid({
  title,
  items,
  venue,
}: {
  title: string;
  items: readonly { key: keyof Venue; label: string; Icon: typeof Globe }[];
  venue: Venue;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, label, Icon }) => (
          <a
            key={key}
            href={String(venue[key])}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}

function PhotoPlaceholder({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <div className="bg-pink-gradient flex aspect-[4/5] items-center justify-center">
      <span className="font-display text-7xl font-bold text-white/70">
        {initial}
      </span>
    </div>
  );
}
