"use client";

// Home › Social (MESITA-2442): where members go. Activity, not reviews.
// It is Home's Social tab, full width (MESITA-2474, MESITA-2517); the tab
// is its title, so it has no header and no scroller of its own.
//
// OLD-INSTAGRAM NOTIFICATIONS (Pato, MESITA-2515: "display the instagram
// profile of the person and the username and the name just as those old
// instagram notifications. keep super super simple"):
//
//   (●)♥ Perdón liked Contramar                           [▢]
//        ◎ per••• · 1.2K followers · 2h
//
// ONE PLAIN LIST, the time on each row, no day headings (Pato, MESITA-2528:
// "don't do that of today and yesterday … Just the fucking plain list with
// time notation. Keep it simple."; MESITA-2525 had grouped by day).
// TIDY NOTIFICATIONS (MESITA-2525, Pato: "make this more UI friendly … your
// call"): the member's picture wears the verb as an ink badge
// (heart liked, eye viewed), so the list scans without reading.
// One line: the name (bold), the verb, the place (bold), no period; under
// it, muted, the Instagram glyph and the member's Instagram as social proof —
// three letters of the username and an approximate follower count, never
// the whole username (Pato, MESITA-2522: "i don't really want the
// instagram username since it might cause the users to abandond my app …
// mentioing the number of followers because that is all the social proof is
// about") — then the time. No Instagram → the quiet line is the time alone.
// The place's photo on the right; no photo → the card placeholder (family
// icon or initial), never an empty box. Two verbs — liked (stored `saved`)
// and viewed (stored `viewed`); the labels changed, never the keys. There is
// no visited (Pato, MESITA-2567: "there is only viewed and liked").
// ONE PERSON, ONE PLACE, ONE EVENT per row, never "and 4 others" (Pato,
// MESITA-2532: "is juse one person one place events. list all the fucking
// events. its readl time uner you radious or near you, just enough to odn't
// kill"): the server returns every event inside the operator's Area circle
// around the guest, newest first, at most 50, and the pane refetches every
// LIVE_MS while the tab is visible. Members with a verified Instagram appear
// by name; everyone else appears as "A member", with no photo, handle or
// person card (MESITA-2580: only ~10% connect Instagram). No member whose
// card can open (an empty feed, or only "A member" and You) → SAMPLE rows
// too (MESITA-2520, lib/social-sample.ts; MESITA-2583, Pato: "keep a mock
// data in the frontend"): made-up members on Home's real places, AFTER the
// real rows and under their own quiet "Sample activity" line, never
// interleaved; with no rows and no places, the empty state.
//
// A NOTIFICATION STREAM (Pato, MESITA-2535: "feel like a notificartions
// stream but it might also be readable … add an easy refreh button"): a
// header row says where the list is from ("Near you", or "Sample activity")
// beside a round refresh button that spins while it loads, and the list
// stays on screen while it does. After the first load, an event the pane
// has not shown before glows in a light grey that fades out (FRESH_MS), the
// way a new notification lands.
//
// LEVEL 1 (MESITA-2536): scrolled down when events arrive → an ink "↑ N
// new" pill sticks to the top of the pane and takes you up; on touch, pull
// the list down from the top to refresh; what is on screen is marked seen
// (lib/social-seen.ts) so Home's Social tab can wear a dot for anything
// newer.
//
// ONE WHITE BAND (Pato, MESITA-2540: "make a fucking normal box. maybe the
// reload button somewhere else but centralized"): the pane is light grey and
// the rows sit in one white band, EDGE TO EDGE with only a top and bottom
// hairline, never side borders or a rounded card (MESITA-2542: "don't add
// lateral borders, its literally an infiite scrolloing"). Above it, NO
// BUTTON: one quiet centred line, "Updated just now · Refresh", the word
// Refresh the tap target (Pato, MESITA-2543: "that refresh looks vibecoded
// as fuck", A of a board of four); with the sample it reads "Sample
// activity · Refresh". Pull to refresh and the live refresh do the rest.
//
// TWO TARGETS PER ROW, never both (Pato, MESITA-2542: "you can click the
// profile or you can click the palce, but not both. if i click a profile,
// open a modal … in the same scree. if i click the place, then redirect to
// place profile"): the face and the bold name open the PERSON CARD (a
// centred LocalDialog that appears at once, MESITA-2546: picture, name,
// Instagram proof, their recent events here); the bold place name and the
// photo open the place. The card is the member's IDENTITY CARD, the top of
// Me without the phone (MESITA-2547), and under it the places they liked
// (Pato, MESITA-2583: "just like the user and then the places they liked
// and thats it. in one list. not when."): likes only, never views, no time.

import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ChevronRight,
  Eye,
  Heart,
  RotateCw,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  apiLikedPlaces,
  apiListActivityFeed,
  type ActivityFeedItem,
  type ActivityKind,
  type ActivityPerson,
} from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import { sampleActivity, type SampleFeedItem } from "@/lib/social-sample";
import { markSocialSeen } from "@/lib/social-seen";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placeHref } from "@/lib/place-route";
import { cardPhoto, placePlaceholder } from "@/lib/place-placeholder";
import { FamilyIcon } from "@/lib/family-icons";
import { EmptyState } from "@/components/shared";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { IdentityCard } from "@/components/consumer/IdentityCard";
import { toGuestClass } from "@/lib/guest-standing";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn, errMsg, firstInitial } from "@/lib/utils";
import { approxFollowers } from "@/lib/consumer-identity";

// Re-exported: the rounding lives with the identity model (MESITA-2574).
export { approxFollowers };

/** The words for the stored kinds (MESITA-2515): the keys never change. */
export const VERB: Record<ActivityKind, string> = {
  saved: "liked",
  viewed: "viewed",
};

/** "2h", "5m", "3d": the feed's clock. */
export function shortAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const mins = Math.floor(diff / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** Who leads the line: "You", else the member's name. */
export function feedWho(lead: ActivityPerson): string {
  if (lead.isYou) return "You";
  return lead.name;
}

/** "per" → "per•••": the username blocked after its first letters. */
export function maskedHandle(hint: string | null): string | null {
  return hint ? `${hint}•••` : null;
}


/** The Instagram proof on a row's quiet line ("per••• · 1.2K followers"; the
 *  glyph before it says Instagram), or null without Instagram (or for the
 *  guest's own row). */
export function feedInstagram(lead: ActivityPerson): string | null {
  const handle = lead.isYou ? null : maskedHandle(lead.handleHint);
  if (!handle) return null;
  const followers = approxFollowers(lead.followers);
  return followers ? `${handle} · ${followers} followers` : handle;
}

/** "Perdón liked" / "You viewed": one person, never "and N others". */
export function feedSentence(
  item: Pick<ActivityFeedItem, "person" | "kind">,
): string {
  return `${feedWho(item.person)} ${VERB[item.kind]}`;
}

/** How often the open pane asks again (MESITA-2532: live, "just enough to
 *  odn't kill"). */
export const LIVE_MS = 30_000;

/** The verb's badge on the face (MESITA-2525): ink, so the list scans by
 *  shape; the sentence still says the verb for a screen reader. */
const VERB_ICON: Record<ActivityKind, LucideIcon> = {
  saved: Heart,
  viewed: Eye,
};

/** Lucide dropped its brand marks, so Instagram is drawn here in lucide's
 *  own 24px grid, stroke and caps (the way family-icons draws the taco). */
function InstagramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

/** The member's Instagram picture, or their initial, wearing the verb. */
function Face({
  person,
  kind,
}: {
  person: ActivityPerson;
  kind: ActivityKind;
}) {
  const Glyph = VERB_ICON[kind];
  return (
    <span className="relative block h-11 w-11 shrink-0">
      {person.anonymous ? (
        <span
          className="bg-muted text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full"
          data-social-anonymous
        >
          <UserRound className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
      ) : person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.avatarUrl}
          alt=""
          className="h-11 w-11 rounded-full object-cover"
        />
      ) : (
        <span className="bg-muted text-foreground flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold">
          {firstInitial(person.name.replace(/^@/, ""))}
        </span>
      )}
      <span
        aria-hidden
        className="bg-foreground text-background ring-card absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2"
        data-social-verb={kind}
      >
        <Glyph
          className="h-[11px] w-[11px]"
          strokeWidth={2.75}
          fill={kind === "saved" ? "currentColor" : "none"}
        />
      </span>
    </span>
  );
}

/** The place's photo, else the card placeholder — never an empty box
 *  (a Google-only place never shows a photo, lib/place-placeholder.ts).
 *  Its box is `block`: inside the row's place link an inline span drops
 *  its 44px size and the photo renders full size (MESITA-2544). */
function Thumb({ place }: { place: Place }) {
  const photo = cardPhoto(place);
  if (photo) {
    return (
      <span className="bg-muted block h-11 w-11 shrink-0 overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const placeholder = placePlaceholder(place);
  return (
    <span
      className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
      data-placeholder={placeholder.kind}
    >
      {placeholder.kind === "family" ? (
        <FamilyIcon name={placeholder.family} className="h-5 w-5" />
      ) : (
        <span aria-hidden className="text-sm font-semibold">
          {placeholder.text}
        </span>
      )}
    </span>
  );
}

/** The quiet line above the list (MESITA-2543): "Sample activity", or how
 *  long ago it loaded ("Updated just now", "Updated 3m ago"). */
export function feedStatus(
  sample: boolean,
  updatedAt: number | null,
  now: number,
): string {
  if (sample) return "Sample activity";
  if (updatedAt == null) return "Updated just now";
  const ago = shortAgo(
    new Date(updatedAt).toISOString(),
    Math.max(now, updatedAt),
  );
  return ago === "now" ? "Updated just now" : `Updated ${ago} ago`;
}

/** One event's identity across refreshes: who, what, where, when. */
export function eventKey(
  item: Pick<ActivityFeedItem, "placeId" | "kind" | "at" | "person">,
): string {
  return `${item.placeId}|${item.kind}|${item.at}|${item.person.name}`;
}

/** How long a new event glows before it fades (MESITA-2535). */
export const FRESH_MS = 4_000;

/** Pull to refresh (MESITA-2536): how far the indicator grows, and how far
 *  past which letting go refreshes. */
export const PULL_MAX = 72;
export const PULL_TRIGGER = 56;

function FeedRow({
  item,
  fresh,
  onPerson,
}: {
  item: ActivityFeedItem;
  fresh: boolean;
  onPerson: (item: ActivityFeedItem) => void;
}) {
  const instagram = feedInstagram(item.person);
  const ago = shortAgo(item.at);
  const href = placeHref(item.place.slug || item.place.id);
  const who = feedWho(item.person);
  const door = !item.person.anonymous;
  // TWO TAPS, TWO ZONES (Pato, MESITA-2584: "clearly visible that left part
  // … and right part … are two different clicks"). Left: the person — face,
  // "You viewed", the time — one target that opens the person card (none for
  // an anonymous member, MESITA-2580). Right: the place as its own bordered
  // card — photo, name, chevron — one target that opens the place.
  const person = (
    <>
      <Face person={item.person} kind={item.kind} />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm leading-snug">
          <span className="font-semibold">{who}</span> {VERB[item.kind]}
        </span>
        <span
          className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs"
          data-social-quiet
        >
          {instagram ? (
            <>
              <InstagramGlyph className="h-3 w-3 shrink-0" />
              <span className="sr-only">Instagram</span>
              <span className="truncate" data-social-instagram>
                {instagram}
              </span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="shrink-0">{ago}</span>
        </span>
      </span>
    </>
  );
  return (
    <li
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 transition-colors duration-1000",
        fresh && "bg-muted",
      )}
      data-social-row
      data-social-fresh={fresh || undefined}
    >
      {door ? (
        <button
          type="button"
          onClick={() => onPerson(item)}
          aria-label={`${who}'s profile`}
          className="focus-visible:ring-ring hover:bg-muted active:bg-muted flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left outline-none focus-visible:ring-2"
          data-social-person
        >
          {person}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3 p-1">
          {person}
        </span>
      )}
      <Link
        href={href}
        className="border-border bg-card focus-visible:ring-ring hover:bg-muted active:bg-muted flex w-[48%] max-w-[200px] shrink-0 items-center gap-2 rounded-xl border p-1.5 outline-none focus-visible:ring-2"
        data-social-place
      >
        <Thumb place={item.place} />
        <span className="text-foreground line-clamp-2 min-w-0 flex-1 text-xs leading-snug font-semibold">
          {item.place.name}
        </span>
        <ChevronRight
          className="text-muted-foreground h-3.5 w-3.5 shrink-0"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/** A feed row as the person card reads it: a sample member carries their
 *  liked places; a real one is asked for them. */
type CardItem = ActivityFeedItem & { sampleLiked?: Place[] };

/** The places the card's member liked: the sample's own, else the server's
 *  for the event the card was opened from (MESITA-2583). Null while it
 *  loads; a failed read lists nothing rather than guessing. */
function useLikedPlaces(item: CardItem | null, open: boolean): Place[] | null {
  const supabase = useBrowserSupabase();
  const key = item ? eventKey(item) : null;
  const [loaded, setLoaded] = useState<{ key: string; places: Place[] } | null>(
    null,
  );
  const sample = item?.sampleLiked ?? null;
  useEffect(() => {
    if (!open || !item || sample || !key) return;
    let cancelled = false;
    apiLikedPlaces(supabase, item)
      .then((places) => {
        if (!cancelled) setLoaded({ key, places });
      })
      .catch((err) => {
        console.error(
          "social_liked_places_failed",
          errMsg(err, "consumer-web-list-activity failed"),
        );
        if (!cancelled) setLoaded({ key, places: [] });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key, open, sample]);
  if (sample) return sample;
  return loaded && loaded.key === key ? loaded.places : null;
}

/** The person card (MESITA-2546, MESITA-2547, MESITA-2583): the member's
 *  identity card — the same card as the top of Me — floating in the centre
 *  of this screen, appearing and disappearing at once, then the places they
 *  liked in one plain list. Picture, name and Instagram with the handle
 *  hidden ("die••• · 1.2K followers", MESITA-2522); never the phone, never a
 *  view, never a time, no follow (Pato: "just like the user and then the
 *  places they liked and thats it. in one list. not when."). */
function PersonCard({
  item,
  open,
  onClose,
}: {
  item: CardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const liked = useLikedPlaces(item, open);
  if (!item) return null;
  const person = item.person;
  const who = feedWho(person);
  const instagram = feedInstagram(person);
  return (
    <LocalDialog
      open={open}
      onClose={onClose}
      ariaLabel={`${who}'s profile`}
      instant
    >
      <div className="p-5" data-social-person-card>
        <IdentityCard
          name={who}
          avatarUrl={person.avatarUrl}
          instagram={instagram ? { label: instagram } : null}
          guestClass={toGuestClass(person.guestClass)}
        />
        <LikedList places={liked} />
      </div>
    </LocalDialog>
  );
}

/** The card's one list: the places the member liked, each a door to the
 *  place. Name and photo only — no time, no verb, no distance. */
function LikedList({ places }: { places: Place[] | null }) {
  if (places == null) {
    return (
      <div className="mt-4 space-y-2" aria-busy data-social-liked-loading>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        ))}
      </div>
    );
  }
  if (places.length === 0) {
    return (
      <p
        className="text-muted-foreground mt-4 text-center text-sm"
        data-social-liked-empty
      >
        No liked places yet
      </p>
    );
  }
  return (
    <ul
      role="list"
      aria-label="Liked places"
      className="divide-border border-border mt-4 max-h-[45vh] divide-y overflow-y-auto border-t"
      data-social-liked
    >
      {places.map((place) => (
        <li key={place.id}>
          <Link
            href={placeHref(place.slug || place.id)}
            className="focus-visible:ring-ring flex items-center gap-3 py-2.5 outline-none focus-visible:ring-2"
            data-social-liked-place
          >
            <Thumb place={place} />
            <span className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">
              {place.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Loading looks like the rows it waits for. */
function FeedSkeleton() {
  return (
    <div className="bg-muted flex-1 pt-14" data-social-loading aria-busy>
      {/* The same white band as the list (MESITA-2542), so nothing jumps. */}
      <div className="divide-border border-border bg-card divide-y border-y">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The rows to draw: the real feed, then the sample over `samplePlaces`
 *  (MESITA-2520) while no real row opens a person card (MESITA-2583) — the
 *  sample always after the real rows, never interleaved. */
export function feedRows(
  items: ActivityFeedItem[],
  samplePlaces: readonly Place[],
  now = Date.now(),
): { rows: ActivityFeedItem[]; sampleRows: SampleFeedItem[] } {
  const someoneToOpen = items.some((it) => !it.person.anonymous && !it.person.isYou);
  if (someoneToOpen) return { rows: items, sampleRows: [] };
  return { rows: items, sampleRows: sampleActivity(samplePlaces, now) };
}

export function SocialFeed({
  samplePlaces = [],
}: {
  /** Home's All places: the sample's real places while the feed is empty. */
  samplePlaces?: readonly Place[];
}) {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useActiveLocation();
  const from = origin ?? coords;
  const fromKey = from
    ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}`
    : "none";
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; items: ActivityFeedItem[] }
  >({ status: "loading" });
  // Bumped by Try again and the refresh button: the effect refetches.
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // When the list last loaded, and the clock the "Updated …" line reads
  // against (ticked by the live interval, never read during render).
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  // The events already shown (null before the first load, which glows
  // nothing) and the ones that just arrived.
  const seenRef = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const freshTimer = useRef<number | undefined>(undefined);
  // Level 1 (MESITA-2536): the pane's scroller, whether it is at the top,
  // the events that arrived while it was not, and the pull's distance.
  const rootRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(true);
  const [pendingNew, setPendingNew] = useState(0);
  // The person sheet: who is shown, and whether it is open (the item stays
  // while it slides away).
  const [personItem, setPersonItem] = useState<CardItem | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const scroller = () =>
    rootRef.current?.closest<HTMLElement>("[data-home-scroller]") ?? null;
  const refresh = () => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiListActivityFeed(
        supabase,
        from ? { lat: from.lat, lng: from.lng } : null,
      )
        .then((items) => {
          if (cancelled) return;
          const keys = items.map(eventKey);
          const seen = seenRef.current;
          const arrived = seen ? keys.filter((k) => !seen.has(k)) : [];
          seenRef.current = new Set([...(seen ?? []), ...keys]);
          if (arrived.length > 0 && !atTopRef.current) {
            setPendingNew((n) => n + arrived.length);
          }
          // What is on screen is seen; the tab's dot waits for anything newer.
          markSocialSeen(items[0]?.at);
          if (arrived.length > 0) {
            setFresh(new Set(arrived));
            window.clearTimeout(freshTimer.current);
            freshTimer.current = window.setTimeout(
              () => setFresh(new Set()),
              FRESH_MS,
            );
          }
          const at = Date.now();
          setUpdatedAt(at);
          setNow(at);
          setState({ status: "ready", items });
          setRefreshing(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setRefreshing(false);
          // A failed refresh keeps the list on screen; only a first load
          // that fails shows the error.
          setState((prev) =>
            prev.status === "ready"
              ? prev
              : {
                  status: "error",
                  message: errMsg(err, "Couldn't load Social"),
                },
          );
        });
    load();
    // Live: ask again while the tab is in view (MESITA-2532).
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") load();
    }, LIVE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fromKey, attempt]);

  useEffect(() => () => window.clearTimeout(freshTimer.current), []);

  // Scrolled to the top by hand: the pill has nothing left to say.
  const ready = state.status === "ready";
  useEffect(() => {
    const el = rootRef.current?.closest<HTMLElement>("[data-home-scroller]");
    if (!el) return;
    const onScroll = () => {
      const top = el.scrollTop <= 8;
      atTopRef.current = top;
      if (top) setPendingNew(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ready]);

  const feed = useMemo(
    () => feedRows(state.status === "ready" ? state.items : [], samplePlaces),
    [state, samplePlaces],
  );

  if (state.status === "loading") return <FeedSkeleton />;
  if (state.status === "error") {
    return (
      <EmptyState
        icon={Users}
        title="Couldn't load Social"
        description={state.message}
        action={{
          label: "Try again",
          onClick: () => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          },
        }}
      />
    );
  }
  // Only the sample on screen: the status line says so.
  const sampleOnly = feed.rows.length === 0 && feed.sampleRows.length > 0;
  const openPerson = (it: CardItem) => {
    setPersonItem(it);
    setPersonOpen(true);
  };
  if (feed.rows.length === 0 && feed.sampleRows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No activity yet"
        description="When members with Instagram like or view a place, it shows up here."
      />
    );
  }
  return (
    <div
      ref={rootRef}
      className="bg-muted flex-1 pb-6"
      onTouchStart={(e) => {
        const el = scroller();
        pullStart.current =
          el && el.scrollTop <= 0 ? e.touches[0].clientY : null;
      }}
      onTouchMove={(e) => {
        if (pullStart.current == null) return;
        const dy = e.touches[0].clientY - pullStart.current;
        setPull(dy > 0 ? Math.min(dy * 0.5, PULL_MAX) : 0);
      }}
      onTouchEnd={() => {
        if (pull >= PULL_TRIGGER && !refreshing) refresh();
        pullStart.current = null;
        setPull(0);
      }}
    >
      {pendingNew > 0 ? (
        <div className="sticky top-2 z-10 flex h-0 justify-center">
          <button
            type="button"
            onClick={() => {
              scroller()?.scrollTo({ top: 0, behavior: "smooth" });
              setPendingNew(0);
            }}
            className="bg-foreground text-background flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-md"
            data-social-new-pill
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            {pendingNew} new
          </button>
        </div>
      ) : null}
      <div
        aria-hidden
        className="flex items-end justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull }}
        data-social-pull
      >
        <RotateCw
          className="text-muted-foreground mb-2 h-5 w-5"
          strokeWidth={2}
          style={{
            transform: `rotate(${pull * 5}deg)`,
            opacity: Math.min(1, pull / PULL_TRIGGER),
          }}
        />
      </div>
      <p
        className="text-muted-foreground flex items-center justify-center gap-1 pt-1 pb-1 text-xs"
        data-social-status
        data-social-sample={sampleOnly || undefined}
        aria-live="polite"
      >
        {refreshing ? (
          <span className="py-3">Refreshing…</span>
        ) : (
          <>
            <span>{feedStatus(sampleOnly, updatedAt, now)}</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={refresh}
              className="text-foreground focus-visible:ring-ring rounded-sm py-3 font-semibold outline-none focus-visible:ring-2"
              data-social-refresh
            >
              Refresh
            </button>
          </>
        )}
      </p>
      {feed.rows.length > 0 ? (
        <ul
          role="list"
          aria-label="Social"
          className="divide-border border-border bg-card divide-y border-y"
        >
          {feed.rows.map((item, i) => (
            <FeedRow
              key={`${i}|${item.placeId}|${item.kind}`}
              item={item}
              fresh={fresh.has(eventKey(item))}
              onPerson={openPerson}
            />
          ))}
        </ul>
      ) : null}
      {feed.rows.length > 0 && feed.sampleRows.length > 0 ? (
        <p
          className="text-muted-foreground pt-4 pb-1 text-center text-xs"
          data-social-sample
        >
          Sample activity
        </p>
      ) : null}
      {feed.sampleRows.length > 0 ? (
        <ul
          role="list"
          aria-label="Sample activity"
          className="divide-border border-border bg-card divide-y border-y"
        >
          {feed.sampleRows.map((item, i) => (
            <FeedRow
              key={`sample|${i}|${item.placeId}|${item.kind}`}
              item={item}
              fresh={false}
              onPerson={() => openPerson(item)}
            />
          ))}
        </ul>
      ) : null}
      <PersonCard
        item={personItem}
        open={personOpen}
        onClose={() => setPersonOpen(false)}
      />
    </div>
  );
}
