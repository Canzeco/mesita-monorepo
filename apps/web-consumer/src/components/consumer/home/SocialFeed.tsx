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
//        ◎ @perdon · 1.2K followers · 2h   (@per*** until you show yours)
//
// ONE PLAIN LIST, the time on each row, no day headings (Pato, MESITA-2528:
// "don't do that of today and yesterday … Just the fucking plain list with
// time notation. Keep it simple."; MESITA-2525 had grouped by day).
// TIDY NOTIFICATIONS (MESITA-2525, Pato: "make this more UI friendly … your
// call"). The face wears no verb badge (Pato, MESITA-2604: "remove the icon
// expressing the event type … it looks as a profile characteristic"); the
// sentence says the verb. THE FACE IS THE MEMBER'S PICTURE ON EVERY ROW, a
// view included, with two marks in the shape that badge had
// (Pato, MESITA-2608: "show the profile picture but you must also show if
// instagram or something … if it is vip, add small bubble at right of
// profile picture … Remember the bubble you had for the event type. well do
// the same for the subtype of user"): Instagram bottom-left when verified,
// a VIP crown bottom-right. The server sends the photo and the marks for
// every member who keeps Public profile on.
// One line, ALWAYS THIRD PERSON (Pato, MESITA-3051: "never mention first
// person, always mention all as third person, even if the event is
// yourself"; it retires "You"): the member's @handle and an approximate
// follower count when they show their Instagram ("if has instagram don't
// mention the name, mention the instgarma username instead"), else the first
// name; then the verb, the place, no period. Views carry the handle too
// (retires MESITA-2594's nameless view). You see others' handles only if you
// show yours (MESITA-2594): a masked "@per***" never leads, the first name
// does. Under it, muted, the time and the place's km.
// The place's photo on the right; no photo → the card placeholder (family
// icon or initial), never an empty box. Two verbs — liked (stored `saved`)
// and viewed (stored `viewed`); the labels changed, never the keys. There is
// no visited (Pato, MESITA-2567: "there is only viewed and liked").
// ONE PERSON, ONE PLACE, ONE EVENT per row, never "and 4 others" (Pato,
// MESITA-2532: "is juse one person one place events. list all the fucking
// events. its readl time uner you radious or near you, just enough to odn't
// kill"): the server returns every event inside the operator's Area circle
// around the guest, newest first, at most 50, and the pane refetches every
// LIVE_MS while the tab is visible. NEVER "A MEMBER" (Pato, MESITA-2612:
// "who the fuck is a member, remove that shit"; it retires MESITA-2580's and
// MESITA-2594's "A member"): a handle, else the first name. NO MOCK DATA
// (Pato, MESITA-2591: "remove mock data"; it reverses MESITA-2520's sample
// rows): only the server's rows, and with none, the empty state.
//
// A NOTIFICATION STREAM (Pato, MESITA-2535: "feel like a notificartions
// stream but it might also be readable … add an easy refreh button"): a
// header row says how fresh the list is beside a refresh, and the list
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
// as fuck", A of a board of four). Pull to refresh and the live refresh do
// the rest.
//
// TWO TARGETS PER ROW, never both (Pato, MESITA-2542: "you can click the
// profile or you can click the palce, but not both. if i click a profile,
// open a modal … in the same scree. if i click the place, then redirect to
// place profile"): the face and the sentence open the PERSON CARD (a
// centred LocalDialog that appears at once, MESITA-2546); the photo on the
// right opens the place. EVERY ROW IS A DOOR, the guest's own included
// (Pato, MESITA-2609: "if i press profile link, then open the modal. i can
// even click my own profile btw"); MESITA-2580 had sent an anonymous row to
// the place. The card is the member's IDENTITY CARD, the top of Me without
// the phone (MESITA-2547: photo, name, "Insta: …", Class, Plan), and under
// it THEIR WHOLE HISTORY, liked and viewed, newest first, scrollable (Pato,
// MESITA-2609: "a list of notifications of exactly that user … he clicked
// that or liked that place … just all the historic feed scrollable"; it
// replaces MESITA-2583's liked-only list). The card shows the handle by a
// like's rule, so it may show one a view row did not (decision,
// MESITA-2609). AN X CLOSES IT (Pato, MESITA-2681: "add the X to close"),
// A PLAIN GLYPH, NO DISC (Pato, MESITA-2709: "make a better X … its to bix
// and looks like shit"), and the history scrolls with no bar drawn over its
// photos ("fix the scrolling bar").

import { Suspense, useEffect, useRef, useState, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Clock,
  Crown,
  Eye,
  Heart,
  MapPin,
  RotateCw,
  Users,
  X,
} from "lucide-react";
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { Instagram } from "@/components/shared/instagram-icon";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  apiListActivityFeed,
  apiMemberHistory,
  isMesitaPlaceId,
  type ActivityFeedItem,
  type ActivityKind,
  type ActivityPerson,
  type MemberHistoryItem,
} from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import { markSocialSeen } from "@/lib/social-seen";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placeHref } from "@/lib/place-route";
import { cardPhoto, placePlaceholder } from "@/lib/place-placeholder";
import { EmptyState, Skeleton } from "@/components/shared";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { IdentityCard } from "@/components/consumer/IdentityCard";
import { toGuestClass, toGuestPlan } from "@/lib/guest-standing";
import { cn, errMsg, formatKm } from "@/lib/utils";
import {
  approxFollowers,
  instagramWithFollowers,
} from "@/lib/consumer-identity";
import { useConsumerIdentity } from "@/lib/identity-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { trackEvent } from "@/lib/analytics/track";

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

/** Who leads the line, always in the third person (Pato, MESITA-3051:
 *  "never mention first person … even if the event is yourself"): the
 *  member's @handle when they show their Instagram ("if has instagram don't
 *  mention the name, mention the instgarma username instead"), else the
 *  first name. A masked "@per***" never stands in for a name. */
export function feedWho(lead: ActivityPerson): string {
  if (lead.handle && !lead.handleLocked) return `@${lead.handle}`;
  return lead.name;
}

/** "(1.2K followers)" beside a lead @handle (MESITA-3051), or null: no
 *  handle on the line, or no count to show. */
export function feedFollowers(lead: ActivityPerson): string | null {
  if (!lead.handle || lead.handleLocked) return null;
  const followers = approxFollowers(lead.followers);
  return followers ? `(${followers} followers)` : null;
}

/** "@perdon (1.2K followers) liked" / "Sofia viewed": one person, never
 *  "and N others", never "You". */
export function feedSentence(
  item: Pick<ActivityFeedItem, "person" | "kind">,
): string {
  const followers = feedFollowers(item.person);
  return [feedWho(item.person), followers, VERB[item.kind]]
    .filter(Boolean)
    .join(" ");
}

/** How often the open pane asks again (MESITA-2532: live, "just enough to
 *  odn't kill"). */
export const LIVE_MS = 30_000;

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

/** A word in the sentence that names a door (MESITA-2608): bold and
 *  underlined, the underline thin and a step down so it reads as a link, not
 *  a strike. */
const LINK_WORD_CLASS =
  "font-semibold underline decoration-1 underline-offset-2 decoration-foreground/40";

/** One mark on the face (MESITA-2608): the 20px ringed bubble MESITA-2525's
 *  verb badge was, now saying what KIND of member this is. */
const MARK_CLASS =
  "ring-card absolute -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2";

/** The member's picture when the server has one — on every row since
 *  MESITA-2608 — else THE ONE NO-PHOTO FACE, the same `DefaultAvatar` Me
 *  draws (MESITA-2620, Pato: "use same icon for me and consumer for
 *  anonymous as instagram anonymous"); anonymous or not, never an initial,
 *  never a lucide glyph. No verb badge (MESITA-2604). Two marks: Instagram
 *  bottom-left when verified, a VIP crown bottom-right (never for Regular,
 *  never Plan). */
function Face({ person }: { person: ActivityPerson }) {
  const vip = person.guestClass === "vip";
  return (
    <span className="relative block h-11 w-11 shrink-0">
      {person.avatarUrl ? (
        <SizedImg
          src={person.avatarUrl}
          size="thumb"
          alt=""
          className="h-11 w-11 rounded-full object-cover"
        />
      ) : (
        <span
          className="block h-11 w-11 overflow-hidden rounded-full"
          data-social-anonymous={person.anonymous ? "" : undefined}
        >
          <DefaultAvatar className="h-full w-full" />
        </span>
      )}
      {person.instagram && (
        <span
          aria-hidden
          className={cn(
            MARK_CLASS,
            "-left-1 text-white",
            INSTAGRAM_ICON_GRADIENT_CLASS,
          )}
          data-social-mark="instagram"
        >
          <Instagram className="h-[11px] w-[11px]" strokeWidth={2.5} />
        </span>
      )}
      {vip && (
        <span
          aria-hidden
          className={cn(MARK_CLASS, "bg-foreground text-paper -right-1")}
          data-social-mark="vip"
        >
          <Crown className="h-[11px] w-[11px]" strokeWidth={2.75} />
        </span>
      )}
      {(person.instagram || vip) && (
        <span className="sr-only">
          {[person.instagram ? "On Instagram" : null, vip ? "VIP" : null]
            .filter(Boolean)
            .join(", ")}
        </span>
      )}
    </span>
  );
}

/** The place's photo, else the card placeholder — never an empty box
 *  (a Google-only place never shows a photo, lib/place-placeholder.ts).
 *  Its box is `block`: inside the row's place link an inline span drops
 *  its 48px size and the photo renders full size (MESITA-2544). */
function Thumb({ place }: { place: Place }) {
  const photo = cardPhoto(place);
  if (photo) {
    return (
      <span className="bg-muted ring-border block h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1">
        <SizedImg
          src={photo}
          size="thumb"
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  const placeholder = placePlaceholder(place);
  return (
    <span
      className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      data-placeholder={placeholder.kind}
    >
      {placeholder.kind === "emoji" ? (
        <span aria-hidden className="text-2xl leading-none">
          {placeholder.emoji}
        </span>
      ) : (
        <span aria-hidden className="text-sm font-semibold">
          {placeholder.text}
        </span>
      )}
    </span>
  );
}

/** The quiet line above the list (MESITA-2543): how long ago it loaded
 *  ("Updated just now", "Updated 3m ago"). */
export function feedStatus(updatedAt: number | null, now: number): string {
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
  const followers = feedFollowers(item.person);
  const ago = shortAgo(item.at);
  const href = placeHref(item.place.slug || item.place.id);
  const who = feedWho(item.person);
  // THREE THINGS (Pato, MESITA-2591: "Profile picture at the left, place at
  // the right, what happened in text in the center. thats it."). Face and
  // sentence are one target, the person card, on every row (MESITA-2609).
  // The photo on the right always opens the place.
  const person = (
    <>
      <Face person={item.person} />
      <span className="min-w-0 flex-1">
        {/* THE NAME AND THE PLACE ARE UNDERLINED (Pato, MESITA-2608:
            "highlight both username and placename, like underline to
            express that its a link"): the two bold words are the two
            things a row opens, the person and the place, so they read as
            links. The verb between them stays plain. */}
        <span className="text-foreground line-clamp-2 text-sm leading-snug">
          <span className={LINK_WORD_CLASS}>{who}</span>{" "}
          {followers ? <>{followers} </> : null}
          {VERB[item.kind]}{" "}
          <span className={LINK_WORD_CLASS}>{item.place.name}</span>
        </span>
        <span
          className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs"
          data-social-quiet
        >
          <span className="flex shrink-0 items-center gap-0.5" data-social-ago>
            <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            {ago}
          </span>
          {item.distanceKm != null ? (
            <>
              <span aria-hidden>·</span>
              {/* THE PLACE'S DISTANCE, NEVER THE EVENT'S (MESITA-2946, Pato:
                  "someone can move between two notifications and use some
                  trigonometry … to find someone"). */}
              <span
                className="flex shrink-0 items-center gap-0.5"
                data-social-place-km
              >
                <MapPin className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                {formatKm(item.distanceKm)}
              </span>
            </>
          ) : null}
        </span>
      </span>
    </>
  );
  return (
    <li
      className={cn(
        "hover:bg-muted/40 flex items-center gap-3 px-4 py-3.5 transition-colors duration-1000",
        fresh && "bg-muted",
      )}
      data-social-row
      data-social-fresh={fresh || undefined}
    >
      <button
        type="button"
        onClick={() => onPerson(item)}
        aria-label={`${who}'s profile`}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2"
        data-social-person
      >
        {person}
      </button>
      <Link
        href={href}
        aria-label={item.place.name}
        className="focus-visible:ring-ring block shrink-0 rounded-xl outline-none focus-visible:ring-2"
        data-social-place
      >
        <Thumb place={item.place} />
      </Link>
    </li>
  );
}

/** THE OPEN CARD IS AN ADDRESS (MESITA-3026, Pato: "use routing there …
 *  have a bit persistence"): /home/social?person=<place>&kind=<verb>&at=<time>,
 *  and &grid=saved on the Likes tab. The event names the member, never a
 *  member id (MESITA-2460). Opening a card pushes it, so back from a place
 *  the card is open again; the tab is replaced, never pushed. */
export type CardEvent = Pick<ActivityFeedItem, "placeId" | "kind" | "at">;

export function cardEventOf(params: {
  get(name: string): string | null;
}): CardEvent | null {
  const placeId = params.get("person");
  const kind = params.get("kind");
  const at = params.get("at");
  if (!placeId || !isMesitaPlaceId(placeId)) return null;
  if (kind !== "saved" && kind !== "viewed") return null;
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  return { placeId, kind, at };
}

export function cardHref(
  base: string,
  event: CardEvent,
  tab: HistoryTab,
): string {
  const q = new URLSearchParams({
    person: event.placeId,
    kind: event.kind,
    at: event.at,
  });
  if (tab === "saved") q.set("grid", "saved");
  return `${base}?${q.toString()}`;
}

const cardKey = (e: CardEvent) => `${e.placeId}|${e.kind}|${e.at}`;

/** What survives leaving Home for a place and coming back (MESITA-3026):
 *  the last feed, each opened card's history, and each card's mounted tiles
 *  and scroll. In memory only, for this tab's life; every one is refetched
 *  behind what it repaints. */
let lastFeed: ActivityFeedItem[] | null = null;
const MEMORY_CARDS = 20;
const historyMemory = new Map<string, MemberHistory>();
const cardMemory = new Map<
  string,
  { shown: Partial<Record<HistoryTab, number>>; scrollTop: number }
>();
/** The card this tab pushed, so its close is a back, not a second entry. */
let pushedCard: string | null = null;
function setPushedCard(key: string | null) {
  pushedCard = key;
}

function remember<V>(map: Map<string, V>, key: string, value: V) {
  map.delete(key);
  map.set(key, value);
  if (map.size > MEMORY_CARDS) map.delete(map.keys().next().value as string);
}

function cardMemoryOf(key: string) {
  let mem = cardMemory.get(key);
  if (!mem) {
    mem = { shown: {}, scrollTop: 0 };
    remember(cardMemory, key, mem);
  }
  return mem;
}

/** The places the card's member liked, from the server for the event the
 *  card was opened from (MESITA-2583). Null while it loads; a failed read
 *  lists nothing rather than guessing. */
type MemberHistory = {
  person: ActivityPerson | null;
  items: MemberHistoryItem[];
};

/** The member behind the open card and their history (MESITA-2609); null
 *  while it loads. A failed read shows the row's person and no history. */
function useMemberHistory(event: CardEvent | null): MemberHistory | null {
  const supabase = useBrowserSupabase();
  const key = event ? cardKey(event) : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    history: MemberHistory;
  } | null>(null);
  useEffect(() => {
    if (!event || !key) return;
    let cancelled = false;
    apiMemberHistory(supabase, event)
      .then((history) => {
        remember(historyMemory, key, history);
        if (!cancelled) setLoaded({ key, history });
      })
      .catch((err) => {
        console.error(
          "social_member_history_failed",
          errMsg(err, "consumer-web-get-person failed"),
        );
        // A remembered history stays on screen; only a first read that
        // fails shows none.
        if (!cancelled && !historyMemory.has(key)) {
          setLoaded({ key, history: { person: null, items: [] } });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key]);
  if (!key) return null;
  return loaded && loaded.key === key
    ? loaded.history
    : (historyMemory.get(key) ?? null);
}

/** The card's Instagram box, Me's own wording (MESITA-2606): "Insta: @handle
 *  · 1.2K followers", a masked "Insta: @per***", or "No Instagram" (a fact
 *  about the member, MESITA-2696; "Insta: not connected" before).
 *  On your own card the handle shows too. */
function cardInstagramLabel(person: ActivityPerson): string {
  if (!person.handle) return "No Instagram";
  return instagramWithFollowers(
    `Insta: @${person.handle}`,
    person.followers,
    true,
  );
}

/** The person card (MESITA-2546, MESITA-2547, MESITA-2609): the member's
 *  identity card — the same card as the top of Me, photo and the four boxes
 *  — floating in the centre of this screen, appearing and disappearing at
 *  once, then THEIR WHOLE HISTORY, liked and viewed, newest first, in one
 *  scrollable list (Pato: "just all the historic feed scrollable"; it was
 *  the liked places alone, MESITA-2583). Never the phone, no follow. The
 *  server's person wins over the row's: its handle follows a like's rule, so
 *  a view row may open on a handle. Mesita first (MESITA-2594):
 *  Open Instagram is a small link under the list, not the card's main
 *  button. A masked handle ("per***") has no link; the card says how to see
 *  it. A plain X sits in its top-right corner, the glyph alone at the
 *  card's padding corner (MESITA-2681 drew the route sheets' 44px bordered
 *  disc there; MESITA-2709 made it the bare glyph); the backdrop and
 *  Escape still close it too. */
function PersonCard({
  event,
  fallback,
  tab,
  onTab,
  onClose,
}: {
  event: CardEvent | null;
  /** The feed row's person, drawn until the server's arrives. */
  fallback: ActivityPerson | null;
  tab: HistoryTab;
  onTab: (tab: HistoryTab) => void;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const history = useMemberHistory(event);
  const { igConnected } = useConsumerIdentity();
  const scrollRef = useRef<HTMLDivElement>(null);
  const key = event ? cardKey(event) : null;
  const ready = history != null;
  // Back on a remembered card: the scroll it was left at, once its tiles
  // are mounted (the dialog's portal can mount a frame late).
  useEffect(() => {
    if (!key || !ready) return;
    const top = cardMemory.get(key)?.scrollTop ?? 0;
    if (top <= 0) return;
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = top;
    });
    return () => cancelAnimationFrame(raf);
  }, [key, ready]);
  if (!event || !key) return null;
  const person = history?.person ?? fallback;
  const who = person ? person.name : "Member";
  const igUrl =
    person && person.handle && !person.isYou && !person.handleLocked
      ? `https://www.instagram.com/${encodeURIComponent(person.handle)}/`
      : null;
  return (
    <LocalDialog
      open
      onClose={onClose}
      ariaLabel={`${who}'s profile`}
      instant
      scroll
    >
      {/* ONE SCROLLER, THE WHOLE CARD (Pato, MESITA-2845: "make this UI
          easier to scroll"): the identity boxes scroll away with the
          history, Instagram's profile, instead of a 45vh box under a header
          that never moved. The card is always the screen's full height, a
          short history or a tab switch never moves its top (Pato,
          MESITA-2965: "the header must be always at the same vertical
          coords"); the X is
          positioned on the panel, not this scroller, so it stays put. No bar,
          and a fling at either end stays in the card. */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          cardMemoryOf(key).scrollTop = e.currentTarget.scrollTop;
        }}
        className="scrollbar-hide min-h-0 overflow-y-auto overscroll-y-contain p-5"
        data-social-person-card
      >
        {/* A PLAIN X, NO DISC (Pato, MESITA-2709: "make a better X … its to
            bix and looks like shit"; MESITA-2681 had drawn the route sheets'
            44px bordered disc here, as wide as the photo beside it). Only
            the 20px ink glyph shows, its box flush with the card's padding
            corner (top-2 + 12px of the 44px button = the p-5 inset); the
            44px tap target around it is invisible until a hover draws the
            muted disc — the onboarding step bar's and the pin picker's own
            close. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-foreground hover:bg-muted focus-visible:ring-ring absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full transition outline-none focus-visible:ring-2"
          data-social-person-close
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        {person ? (
          <IdentityCard
            name={who}
            avatarUrl={person.avatarUrl}
            instagram={{
              label: cardInstagramLabel(person),
              connected: Boolean(person.handle),
            }}
            guestClass={toGuestClass(person.guestClass)}
            plan={toGuestPlan(person.plan)}
          />
        ) : history ? (
          // A link to a member who is gone (deleted, or the event is).
          <p
            className="text-muted-foreground py-10 text-center text-sm"
            data-social-person-gone
          >
            This profile isn&apos;t available
          </p>
        ) : (
          // Opened from its address before anything is known: the card's
          // own shape, empty.
          <div className="flex flex-col items-center gap-3" aria-busy>
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-full" />
            <div className="flex w-full gap-3">
              <Skeleton className="h-11 flex-1 rounded-full" />
              <Skeleton className="h-11 flex-1 rounded-full" />
            </div>
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        )}
        {/* ONE HAIRLINE, EDGE TO EDGE, between the identity boxes and the
            history (Pato, MESITA-2611: "this activity feed must be divided
            by a line, like in instagram"): the way Instagram's profile
            rules off the header from the grid. The line spans the card
            (-mx-5 undoes the card's padding) and is there in every state,
            rows, skeleton or "No activity yet". */}
        <div
          className="border-border -mx-5 mt-4 border-t"
          data-social-history-divider
        >
          <HistoryList
            key={key}
            memoryKey={key}
            items={history ? history.items : null}
            tab={tab}
            onTab={onTab}
          />
        </div>
        {/* Open Instagram (MESITA-2590): a new tab, so Mesita stays open
            underneath; every tap is counted to measure who leaves. Under
            the list, small (MESITA-2594): the card is Mesita's first. */}
        {igUrl && (
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent(supabase, "social_open_instagram", {})}
            className="text-muted-foreground hover:text-foreground mt-3 flex min-h-11 items-center justify-center gap-1.5 text-sm font-medium"
            data-social-open-instagram
          >
            <InstagramGlyph className="h-3.5 w-3.5" />
            Open Instagram
          </a>
        )}
        {/* You see others' Instagram only if you show yours (MESITA-2594). */}
        {person?.handleLocked && !person.isYou && (
          <Link
            href={CONSUMER_ROUTES.mePages.instagram}
            className="text-muted-foreground hover:text-foreground mt-3 flex min-h-11 items-center justify-center gap-1.5 text-center text-sm font-medium underline underline-offset-4"
            data-social-unlock-instagram
          >
            {igConnected
              ? "Make your profile public to see their Instagram"
              : "Connect your Instagram to see theirs"}
          </Link>
        )}
      </div>
    </LocalDialog>
  );
}

/** The card's two tabs (MESITA-2951, Pato: "make an instagramish list of
 *  views and likes. views left and likes right"): Instagram's profile strip,
 *  an icon per tab, Views (an eye) left, Likes (a heart) right. The keys are
 *  the stored verbs; the labels changed, never the keys. */
export type HistoryTab = "viewed" | "saved";

const HISTORY_TABS: {
  tab: HistoryTab;
  label: string;
  Icon: typeof Eye;
  empty: string;
}[] = [
  { tab: "viewed", label: "Views", Icon: Eye, empty: "No views yet" },
  { tab: "saved", label: "Likes", Icon: Heart, empty: "No likes yet" },
];

/** One tile per place in a tab's grid (MESITA-2854, MESITA-2951): only that
 *  tab's verb, one tile per place at its newest time, newest first. The
 *  server's list is newest first already, so the first event of a place sets
 *  its slot. */
export type HistoryTile = { place: Place; at: string };

export function historyTiles(
  items: MemberHistoryItem[],
  tab: HistoryTab,
): HistoryTile[] {
  const byPlace = new Map<string, HistoryTile>();
  for (const it of items) {
    if (it.kind !== tab || byPlace.has(it.placeId)) continue;
    byPlace.set(it.placeId, { place: it.place, at: it.at });
  }
  return [...byPlace.values()];
}

/** The tile grid's own geometry: three square columns, 2px apart, edge to
 *  edge across the card, Instagram's profile grid. */
const HISTORY_GRID_CLASS = "grid grid-cols-3 gap-0.5";

/** Tiles mounted at a time (MESITA-3025, Pato: "you can load the full list,
 *  but as you scroll load the images"): the whole history arrives at once,
 *  but the grid mounts four rows, then four more each time its foot comes
 *  within HISTORY_AHEAD of the view, so a long history never builds
 *  hundreds of tiles and photos at open. */
const HISTORY_BATCH = 12;
const HISTORY_AHEAD = "600px";

/** The card's history (MESITA-2854, Pato: "this ui to scroll profile events
 *  is shit"): Instagram's profile, a tab strip over a grid, not a list. The
 *  strip (MESITA-2951) splits it, Views left, Likes right, the lit tab ink
 *  with a bar under its icon, the other muted; it opens on Views. Each tile
 *  is the place's photo (or its placeholder), the name on a dark fade at the
 *  foot, and a door to the place; one tile per place. It was one grid of
 *  both verbs with a heart in a liked tile's corner (MESITA-2854), and
 *  before that MESITA-2609's rows. Not a scroller of its own: it scrolls
 *  with the whole card (MESITA-2845), which draws no bar and keeps a fling
 *  at either end from scrolling Home behind it. */
function HistoryList({
  items,
  tab,
  onTab,
  memoryKey,
}: {
  items: MemberHistoryItem[] | null;
  tab: HistoryTab;
  onTab: (tab: HistoryTab) => void;
  memoryKey: string;
}) {
  // How many tiles were mounted on each tab, remembered so back from a place
  // finds the grid as long as it was left (MESITA-3026).
  const [shownBy, setShownBy] = useState<Partial<Record<HistoryTab, number>>>(
    () => ({ ...cardMemoryOf(memoryKey).shown }),
  );
  const shown = shownBy[tab] ?? HISTORY_BATCH;
  const footRef = useRef<HTMLDivElement>(null);
  const current = HISTORY_TABS.find((t) => t.tab === tab) ?? HISTORY_TABS[0];
  const tiles = items ? historyTiles(items, tab) : null;
  const more = tiles != null && shown < tiles.length;
  // The foot of the grid nearing the view mounts the next batch. Observed
  // anew after each batch, so a foot still in view asks again at once.
  useEffect(() => {
    const el = footRef.current;
    if (!more || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShownBy((by) => {
            const next = {
              ...by,
              [tab]: (by[tab] ?? HISTORY_BATCH) + HISTORY_BATCH,
            };
            cardMemoryOf(memoryKey).shown = next;
            return next;
          });
        }
      },
      { rootMargin: `${HISTORY_AHEAD} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown, tab, memoryKey]);
  return (
    <>
      <div
        role="tablist"
        aria-label="Activity"
        className="border-border mb-0.5 flex border-b"
        data-social-history-tabs
      >
        {HISTORY_TABS.map(({ tab: t, label, Icon }) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={label}
              onClick={() => onTab(t)}
              className={cn(
                "focus-visible:ring-ring relative flex h-11 flex-1 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset",
                on ? "text-foreground" : "text-muted-foreground",
              )}
              data-social-history-tab={t}
            >
              <Icon
                aria-hidden
                className="h-6 w-6"
                strokeWidth={on ? 2.25 : 2}
              />
              {on && (
                <span
                  aria-hidden
                  className="bg-foreground absolute bottom-0 left-1/2 h-px w-16 -translate-x-1/2"
                />
              )}
            </button>
          );
        })}
      </div>
      {tiles == null ? (
        // The grid's own tiles, empty (Pato, MESITA-2701: "the placeholders
        // must be similar to the page you are loading, like the sizes").
        <div
          className={HISTORY_GRID_CLASS}
          aria-busy
          data-social-history-loading
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-none" />
          ))}
        </div>
      ) : tiles.length === 0 ? (
        <p
          className="text-muted-foreground mt-3 px-5 text-center text-sm"
          data-social-history-empty
        >
          {current.empty}
        </p>
      ) : (
        <>
          <ul
            role="list"
            aria-label={current.label}
            className={HISTORY_GRID_CLASS}
            data-social-history={tab}
          >
            {tiles.slice(0, shown).map((tile) => (
              <li key={tile.place.id}>
                <HistoryTileLink tile={tile} tab={tab} />
              </li>
            ))}
          </ul>
          {/* The next row, waiting: grey tiles the size of the real ones
              under the last row, never a spinner or a page change. */}
          {more && (
            <div
              ref={footRef}
              className={cn(HISTORY_GRID_CLASS, "mt-0.5")}
              aria-busy
              data-social-history-more
            >
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-square w-full rounded-none"
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function HistoryTileLink({
  tile,
  tab,
}: {
  tile: HistoryTile;
  tab: HistoryTab;
}) {
  const { place, at } = tile;
  const photo = cardPhoto(place);
  const placeholder = photo ? null : placePlaceholder(place);
  // The photo fades in over the grey tile once it has arrived, never
  // painting in strips (MESITA-3025).
  const [shown, setShown] = useState(false);
  return (
    <Link
      href={placeHref(place.slug || place.id)}
      aria-label={`${tab === "saved" ? "Liked" : "Viewed"} ${place.name}, ${shortAgo(at)}`}
      className="focus-visible:ring-ring bg-muted relative block aspect-square overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset"
      data-social-history-event={tab}
    >
      {photo ? (
        <SizedImg
          src={photo}
          size="card"
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setShown(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            shown ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <span
          aria-hidden
          className="text-muted-foreground flex h-full w-full items-center justify-center pb-6"
          data-placeholder={placeholder?.kind}
        >
          {placeholder?.kind === "emoji" ? (
            <span className="text-4xl leading-none">{placeholder.emoji}</span>
          ) : (
            <span className="text-lg font-semibold">{placeholder?.text}</span>
          )}
        </span>
      )}
      <span
        aria-hidden
        className="type-label absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-5 pb-1.5 leading-tight font-semibold text-white"
      >
        <span className="line-clamp-2">{place.name}</span>
      </span>
    </Link>
  );
}

/** Rows the loading band draws: enough to run past the pane's foot, as a
 *  full feed does (each row is 68px). */
const SKELETON_ROWS = 10;

/** Loading is the feed it waits for, block for block (Pato, MESITA-2701:
 *  "the placeholders must be similar to the page you are loading, like the
 *  sizes"): the grey pane with its pb-6; the "Updated … · Refresh" line, 48px
 *  (pt-1 and pb-1 around Refresh's 40px tap row); then the same white band
 *  as the list (MESITA-2542), each row px-4 py-3 around the 44px face, the
 *  14px sentence and the 12px quiet line 2px under it, the 44px photo. */
function FeedSkeleton() {
  return (
    <div className="bg-background flex-1 pb-6" data-social-loading aria-busy>
      <div className="flex items-center justify-center pt-1 pb-1">
        <div className="flex h-10 items-center">
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="divide-border border-border bg-card divide-y border-y">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-3/5" />
              </div>
              <div className="mt-0.5 flex h-4 items-center">
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Social reads its address (the open card), so it waits under Suspense. */
export function SocialFeed() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <SocialFeedBody />
    </Suspense>
  );
}

function SocialFeedBody() {
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
  >(() =>
    // Back on Social: the last list repaints at once while it refetches.
    lastFeed ? { status: "ready", items: lastFeed } : { status: "loading" },
  );
  // Bumped by Try again and the refresh button: the effect refetches.
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // When the list last loaded, and the clock the "Updated …" line reads
  // against (ticked by the live interval, never read during render).
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  // The events already shown (null before the first load, which glows
  // nothing) and the ones that just arrived.
  const seenRef = useRef<Set<string> | null>(
    lastFeed ? new Set(lastFeed.map(eventKey)) : null,
  );
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const freshTimer = useRef<number | undefined>(undefined);
  // Level 1 (MESITA-2536): the pane's scroller, whether it is at the top,
  // the events that arrived while it was not, and the pull's distance.
  const rootRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(true);
  const [pendingNew, setPendingNew] = useState(0);
  // The person card is the address (MESITA-3026).
  const router = useRouter();
  const pathname = usePathname() ?? CONSUMER_ROUTES.homeSocial;
  const params = useSearchParams();
  const cardEvent = params ? cardEventOf(params) : null;
  const cardTab: HistoryTab =
    params?.get("grid") === "saved" ? "saved" : "viewed";
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
          lastFeed = items;
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

  const openPerson = (it: ActivityFeedItem) => {
    setPushedCard(cardKey(it));
    router.push(cardHref(pathname, it, "viewed"), { scroll: false });
  };
  const closePerson = () => {
    if (cardEvent && pushedCard === cardKey(cardEvent)) {
      setPushedCard(null);
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  };
  const cardRow =
    cardEvent && state.status === "ready"
      ? state.items.find((it) => cardKey(it) === cardKey(cardEvent))
      : undefined;
  const card = (
    <PersonCard
      event={cardEvent}
      fallback={cardRow?.person ?? null}
      tab={cardTab}
      onTab={(t) => {
        if (cardEvent) {
          router.replace(cardHref(pathname, cardEvent, t), { scroll: false });
        }
      }}
      onClose={closePerson}
    />
  );

  if (state.status === "loading") {
    return (
      <>
        <FeedSkeleton />
        {card}
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
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
        {card}
      </>
    );
  }
  const rows = state.items;
  if (rows.length === 0) {
    return (
      <>
        <EmptyState
          icon={Users}
          title="No activity yet"
          description="When members like or view a place, it shows up here."
        />
        {card}
      </>
    );
  }
  return (
    <div
      ref={rootRef}
      className="bg-background flex-1 pb-6"
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
            className="bg-foreground text-paper shadow-elev flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold"
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
        aria-live="polite"
      >
        {refreshing ? (
          <span className="py-3">Refreshing…</span>
        ) : (
          <>
            <span>{feedStatus(updatedAt, now)}</span>
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
      <ul
        role="list"
        aria-label="Social"
        className="divide-border border-border bg-card divide-y border-y"
      >
        {rows.map((item, i) => (
          <FeedRow
            key={`${i}|${item.placeId}|${item.kind}`}
            item={item}
            fresh={fresh.has(eventKey(item))}
            onPerson={openPerson}
          />
        ))}
      </ul>
      {card}
    </div>
  );
}
