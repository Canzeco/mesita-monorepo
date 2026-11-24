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
// the same for the subtype of user"): Instagram bottom-left when verified
// (the VIP crown bottom-right left with MESITA-4709, "no more VIP"). The
// server sends the photo and the marks for
// every member: every Mesita profile is public (MESITA-4690).
// One line, ALWAYS THIRD PERSON (Pato, MESITA-3051: "never mention first
// person, always mention all as third person, even if the event is
// yourself"; it retires "You"): the member's name, always (Pato,
// MESITA-3070: "better do show the name instead of the instagram in the
// feed"; it reverses MESITA-3051's @handle lead); then the verb, the place,
// no period. The @handle lives on the person card's Instagram box, and the
// face keeps its Instagram mark. Under it, muted, the time and the place's km.
// The place's photo on the right; no photo → the card placeholder (family
// icon or initial), never an empty box. Two verbs — liked (stored `saved`)
// and viewed (stored `viewed`); the labels changed, never the keys. There is
// no visited (Pato, MESITA-2567: "there is only viewed and liked").
// ONE PERSON, ONE PLACE, ONE EVENT per row, never "and 4 others" (Pato,
// MESITA-2532: "is juse one person one place events. list all the fucking
// events. its readl time uner you radious or near you, just enough to odn't
// kill"): the server returns every event inside the operator's Area circle
// around the guest, newest first, A PAGE AT A TIME as the list's foot nears
// the view (MESITA-3220, Pato: "use pagination loading here in social"), and
// the pane refetches the newest page every LIVE_MS while the tab is visible,
// keeping the older pages it holds. NEVER "A MEMBER" (Pato, MESITA-2612:
// "who the fuck is a member, remove that shit"; it retires MESITA-2580's and
// MESITA-2594's "A member"): the member's name. NO MOCK DATA
// (Pato, MESITA-2591: "remove mock data"; it reverses MESITA-2520's sample
// rows): only the server's rows, and with none, the empty state.
//
// WHAT A ROW SAYS OF A PERSON IS THEIR PRIVACY LEVEL (MESITA-4850, over the
// first name and photo on every row of MESITA-2612/2608/4690): a Public member
// is the gray face and "Woman, mid 20s", with a written F or M mark; a member
// sharing their Instagram is their photo, first name and @handle, masked for
// a viewer who does not share theirs. Private members and minors never come.
//
// A NOTIFICATION STREAM (Pato, MESITA-2535: "feel like a notificartions
// stream but it might also be readable"): the list stays on screen while it
// reads again. After the first load, an event the pane has not shown before
// glows in a light grey that fades out (FRESH_MS), the way a new
// notification lands.
//
// NEW EVENTS WAIT BEHIND THE BANNER (MESITA-4083; the blue banner replaced
// its ink "↑ N new" pill with MESITA-4715): the 30-second re-read never lays
// rows in by itself; what it found waits behind the blue "N new events"
// banner, sticky under the tabs, and its Reload lays them in and goes to the
// top (with nothing held, Reload reads again). Opening Social, a moved
// location and pulling the list down from the top (touch) lay a read
// straight in. The "Updated just now · Refresh" line stays gone. (The Social tab's "new" dot went with
// MESITA-4044.)
//
// ONE WHITE BAND (Pato, MESITA-2540: "make a fucking normal box. maybe the
// reload button somewhere else but centralized"): the pane is light grey and
// the rows sit in one white band (the pane itself is white since
// MESITA-4070, Pato: "that gray refresh looks like shit ... try white
// background"; the band keeps its hairlines), EDGE TO EDGE with only a top and bottom
// hairline, never side borders or a rounded card (MESITA-2542: "don't add
// lateral borders, its literally an infiite scrolloing"). Above it only the
// new-events banner (MESITA-4715).
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
// the phone (MESITA-2547: photo, name, Instagram, Class, Plan), and under
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
import { PushLink } from "@/components/consumer/nav/PushLink";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Eye, Heart, MapPin, RotateCw, Users, X } from "lucide-react";
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { Instagram } from "@/components/shared/instagram-icon";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  apiListActivityFeed,
  apiMemberHistory,
  apiMemberHistoryCards,
  isMesitaPlaceId,
  type ActivityFeedItem,
  type ActivityFeedPage,
  type ActivityKind,
  type ActivityPerson,
  type MemberHistoryItem,
} from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placeHref } from "@/lib/place-route";
import { cardPhoto, placePlaceholder } from "@/lib/place-placeholder";
import { flagEmoji, placeCountry } from "@/lib/place-country";
import { EmptyState, Skeleton } from "@/components/shared";
import { goBack } from "@/lib/navigate";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import {
  PersonInstagramPill,
  PersonModules,
} from "@/components/consumer/IdentityCard";
import { cn, errMsg, formatKm } from "@/lib/utils";
import { approxFollowers } from "@/lib/consumer-identity";
import { useConsumerIdentity, useViewer } from "@/lib/identity-context";
import { trackEvent } from "@/lib/analytics/track";
import { openSignGate } from "@/lib/anonymous";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

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
 *  member's name, never the @handle (Pato, MESITA-3070: "better do show the
 *  name instead of the instagram in the feed"). */
export function feedWho(lead: ActivityPerson): string {
  return lead.name;
}

/** "Perdón liked" / "Sofia viewed": one person, never "and N others",
 *  never "You". No follower count on the line (Pato, MESITA-3060: "just the
 *  username, its cleaner"; MESITA-3051 had added it). */
export function feedSentence(
  item: Pick<ActivityFeedItem, "person" | "kind">,
): string {
  return `${feedWho(item.person)} ${VERB[item.kind]}`;
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
 *  never a lucide glyph. No verb badge (MESITA-2604). One mark: Instagram
 *  bottom-left when verified (no VIP crown since MESITA-4709). */
/** A member's face with its Instagram mark; the place screen's Social tab
 *  draws the same (MESITA-3417). */
export function Face({ person }: { person: ActivityPerson }) {
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
      {person.instagram && <span className="sr-only">On Instagram</span>}
      {!person.instagram && person.sex !== undefined && (
        // A letter beside the colour, never colour alone (MESITA-4850); the
        // sentence says it in words.
        <span
          aria-hidden
          className={cn(
            MARK_CLASS,
            "-left-1 type-label font-bold text-white",
            person.sex === "female" ? "bg-pink-600" : person.sex === "male" ? "bg-blue-600" : "bg-black",
          )}
          data-social-mark={person.sex ?? "undisclosed"}
        >
          {person.sex === "female" ? "F" : person.sex === "male" ? "M" : "–"}
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

/** The place's country as a flag bubble on the photo's bottom-left, in the
 *  face marks' shape (MESITA-4711). No known country → nothing. */
function CountryFlag({ address }: { address: string | null }) {
  const country = placeCountry(address);
  if (!country) return null;
  return (
    <span
      aria-hidden
      className={cn(MARK_CLASS, "bg-foreground -left-1 text-xs leading-none")}
      data-social-flag={country}
    >
      {flagEmoji(country)}
    </span>
  );
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
          <span className={LINK_WORD_CLASS}>{who}</span> {VERB[item.kind]}{" "}
          <span className={LINK_WORD_CLASS}>{item.place.name}</span>
        </span>
        <span
          className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs"
          data-social-quiet
        >
          {item.person.handle && (
            <>
              <span className="min-w-0 truncate" data-social-handle>
                @{item.person.handle}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
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
        <span className="relative block">
          <Thumb place={item.place} />
          <CountryFlag address={item.place.address} />
        </span>
      </Link>
    </li>
  );
}

/** THE OPEN CARD IS AN ADDRESS (MESITA-3026, then a page in MESITA-4113):
 *  /home/social/person?person=<place>&kind=<verb>&at=<time>,
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

/** The member card's page. The query is the event (MESITA-2460, MESITA-4113). */
export const PERSON_PROFILE_PATH = "/home/social/person";

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
 *  the last feed, each opened card's history, and each card's fetched pages
 *  and scroll. In memory only, for this tab's life; every one is refetched
 *  behind what it repaints. */
let lastFeed: (ActivityFeedPage & { fromKey: string }) | null = null;
const MEMORY_CARDS = 20;
const historyMemory = new Map<string, MemberHistory>();
const cardMemory = new Map<
  string,
  { filled: ReadonlyMap<string, Place | null>; scrollTop: number }
>();
function remember<V>(map: Map<string, V>, key: string, value: V) {
  map.delete(key);
  map.set(key, value);
  if (map.size > MEMORY_CARDS) map.delete(map.keys().next().value as string);
}

function cardMemoryOf(key: string) {
  let mem = cardMemory.get(key);
  if (!mem) {
    mem = { filled: new Map(), scrollTop: 0 };
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
    apiMemberHistory(supabase, event, HISTORY_BATCH)
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

/** ADD YOURS TO SEE THEIRS (Pato, 2026-11-22, MESITA-4695: "for instagram
 *  of other people, mention in a yellow pink box: add your instagram to see
 *  other people's instagram, a shortcut button"): the Instagram gradient,
 *  white words, one button to Me › Instagram. */
function AddInstagramBox({ connected }: { connected: boolean }) {
  return (
    <div
      className="flex w-full flex-col items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] px-4 py-3.5 text-center text-white"
      data-social-add-instagram
    >
      <p className="text-sm font-semibold">
        {connected
          ? "Share your Instagram to see other people's Instagram"
          : "Add your Instagram to see other people's Instagram"}
      </p>
      <PushLink
        href={CONSUMER_ROUTES.mePages.instagram}
        className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-950"
      >
        <InstagramGlyph className="h-4 w-4" />
        {connected ? "Share yours to see" : "Add Instagram"}
      </PushLink>
    </div>
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
 *  it. A bar that never scrolls holds the member's name and a plain X
 *  (MESITA-3061; MESITA-2709 made the X the bare glyph); the backdrop and
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
    <div
      className="bg-card flex min-h-0 flex-1 flex-col"
      role="region"
      aria-label={`${who}'s profile`}
    >
      {/* A TOP BAR THAT NEVER SCROLLS (Pato, MESITA-3061: "leave the name
          or something and the x not overlapping"; the X had floated on the
          panel over the tabs and tiles scrolling under it). Instagram's
          profile: the member's lead word, the feed's (the name, MESITA-3070),
          bold on the left; the plain X on the right (Pato,
          MESITA-2709: "make a better X … its to bix and looks like shit"):
          the 20px ink glyph alone, its 44px target invisible until a hover
          draws the muted disc; a hairline under the bar. The card is always
          the screen's full height, so the bar never moves (Pato,
          MESITA-2965: "the header must be always at the same vertical
          coords"). */}
      <div
        className="border-border flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-5"
        data-social-person-bar
      >
        <span
          className="text-foreground min-w-0 flex-1 truncate text-base font-semibold"
          data-social-person-title
        >
          {person ? feedWho(person) : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-foreground hover:bg-muted focus-visible:ring-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition outline-none focus-visible:ring-2"
          data-social-person-close
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {/* ONE SCROLLER UNDER THE BAR (Pato, MESITA-2845: "make this UI
          easier to scroll"): the identity boxes scroll away with the
          history, Instagram's profile, and the Views/Likes strip sticks
          under the bar once it gets there (MESITA-3061). The thin bar shows
          (MESITA-4081: scrolling must be obvious), and
          a fling at either end stays in the card. */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          cardMemoryOf(key).scrollTop = e.currentTarget.scrollTop;
        }}
        className="scrollbar-thin-dark min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        data-social-person-card
      >
        {/* NO PADDING ON THE SCROLLER (MESITA-3064): a sticky child stops at
            its scroller's padding edge, so a p-5 here left the Views/Likes
            strip stuck 20px under the bar with the grid scrolling through
            the gap. Each block carries its own inset instead. */}
        <div className="px-5 pt-5">
          {person ? (
            // THE ME CARD'S FORMAT (Pato, 2026-11-22, MESITA-4695): name,
            // then Instagram (no Class or Plan since MESITA-4709). A viewer without Instagram gets
            // the add-yours box whatever this person has, so it never says
            // whether they have one; "not shared" and "none" read alike.
            <PersonModules
              name={who}
              avatarUrl={person.avatarUrl}
              instagram={
                !person.isYou && (!igConnected || person.handleLocked) ? (
                  <AddInstagramBox connected={igConnected} />
                ) : person.handle && (person.isYou || !person.handleLocked) ? (
                  <PersonInstagramPill
                    label={`@${person.handle}`}
                    href={igUrl}
                    onOpen={() =>
                      trackEvent(supabase, "social_open_instagram", {})
                    }
                  />
                ) : (
                  <PersonInstagramPill label="No Instagram" />
                )
              }
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
              <div className="flex w-full gap-3">
                <Skeleton className="h-11 flex-1 rounded-full" />
                <Skeleton className="h-11 flex-1 rounded-full" />
              </div>
              <Skeleton className="h-11 w-full rounded-full" />
            </div>
          )}
        </div>
        {/* ONE HAIRLINE, EDGE TO EDGE, between the identity boxes and the
            history (Pato, MESITA-2611: "this activity feed must be divided
            by a line, like in instagram"): the way Instagram's profile
            rules off the header from the grid. The line spans the card and
            is there in every state, tiles, skeleton or a tab's empty line. */}
        <div
          className="border-border mt-4 border-t"
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
        <div className="px-5 pb-5"></div>
      </div>
    </div>
  );
}

/** The member card as a page (MESITA-4113). */
export function PersonProfile() {
  const router = useRouter();
  const params = useSearchParams();
  const event = params ? cardEventOf(params) : null;
  const tab: HistoryTab = params?.get("grid") === "saved" ? "saved" : "viewed";
  if (!event) {
    return (
      <p
        className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm"
        data-social-person-gone
      >
        This profile isn&apos;t available
      </p>
    );
  }
  return (
    <PersonCard
      event={event}
      fallback={null}
      tab={tab}
      onTab={(t) => {
        router.replace(cardHref(PERSON_PROFILE_PATH, event, t), {
          scroll: false,
        });
      }}
      onClose={() => goBack(router)}
    />
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
type HistoryEntry = { placeId: string; at: string };

function historyEntries(
  items: MemberHistoryItem[],
  tab: HistoryTab,
): HistoryEntry[] {
  const byPlace = new Map<string, HistoryEntry>();
  for (const it of items) {
    if (it.kind !== tab || byPlace.has(it.placeId)) continue;
    byPlace.set(it.placeId, { placeId: it.placeId, at: it.at });
  }
  return [...byPlace.values()];
}

/** The tile grid's own geometry: three square columns, 2px apart, edge to
 *  edge across the card, Instagram's profile grid. */
const HISTORY_GRID_CLASS = "grid grid-cols-3 gap-0.5";

/** Place cards fetched at a time (MESITA-3212, Pato: "use loading pagination
 *  too when loading profiles"; MESITA-3025 fetched them all and paged only the
 *  tiles): the card opens with its member, every event, and four rows of each
 *  tab, then four more rows come from the server each time the grid's foot is
 *  within HISTORY_AHEAD of the view, Home's own order-then-fill. */
const HISTORY_BATCH = 12;
const HISTORY_AHEAD = "600px";
/** Failed page reads in a row before the grid stops asking until reopened. */
const HISTORY_FILL_TRIES = 3;
const HISTORY_FILL_RETRY_MS = 2000;

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
  const supabase = useBrowserSupabase();
  // The cards fetched after the first page, null for a place no longer
  // listed, remembered so back from a place finds the grid as long as it was
  // left (MESITA-3026).
  const [filled, setFilled] = useState(() => cardMemoryOf(memoryKey).filled);
  const [round, setRound] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const filling = useRef(false);
  const fails = useRef(0);
  const footRef = useRef<HTMLDivElement>(null);
  const current = HISTORY_TABS.find((t) => t.tab === tab) ?? HISTORY_TABS[0];
  const entries = items ? historyEntries(items, tab) : null;
  const known = new Map<string, Place | null>(filled);
  for (const it of items ?? []) if (it.place) known.set(it.placeId, it.place);
  // Tiles run in order up to the first place whose card has not been asked
  // for, so a page never lands above a gap.
  const tiles: HistoryTile[] = [];
  let reached = 0;
  for (const entry of entries ?? []) {
    const place = known.get(entry.placeId);
    if (place === undefined) break;
    if (place) tiles.push({ place, at: entry.at });
    reached += 1;
  }
  const nextIds = (entries ?? [])
    .slice(reached)
    .filter((e) => !known.has(e.placeId))
    .slice(0, HISTORY_BATCH)
    .map((e) => e.placeId);
  const more = nextIds.length > 0 && !gaveUp;
  const nextKey = nextIds.join();
  // The foot of the grid nearing the view fetches the next page. Observed
  // anew after each page, so a foot still in view asks again at once.
  useEffect(() => {
    const el = footRef.current;
    if (!nextKey || gaveUp || !el) return;
    const ids = nextKey.split(",");
    const settle = () => {
      filling.current = false;
      setRound((n) => n + 1);
    };
    const io = new IntersectionObserver(
      (seen) => {
        if (!seen.some((e) => e.isIntersecting) || filling.current) return;
        filling.current = true;
        apiMemberHistoryCards(supabase, ids)
          .then((places) => {
            fails.current = 0;
            setFilled((cur) => {
              const next = new Map(cur);
              for (const id of ids) next.set(id, null);
              for (const p of places) next.set(p.id, p);
              cardMemoryOf(memoryKey).filled = next;
              return next;
            });
            settle();
          })
          .catch((err) => {
            console.warn(
              "social_member_history_page_failed",
              errMsg(err, "consumer-web-get-person failed"),
            );
            fails.current += 1;
            if (fails.current >= HISTORY_FILL_TRIES) setGaveUp(true);
            setTimeout(settle, HISTORY_FILL_RETRY_MS);
          });
      },
      { rootMargin: `${HISTORY_AHEAD} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nextKey, round, gaveUp, memoryKey, supabase]);
  return (
    <>
      <div
        role="tablist"
        aria-label="Activity"
        className="border-border bg-card sticky top-0 z-10 mb-0.5 flex border-b"
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
      {entries == null ? (
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
      ) : tiles.length === 0 && !more ? (
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
            {tiles.map((tile) => (
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

/** The newest page laid over the pages already held (MESITA-3220): it replaces
 *  the rows its span covers and keeps the older ones with their cursor. When it
 *  does not reach the held rows, more arrived than a page holds, and it starts
 *  the list again rather than leave a hole. Times compare as the server's own
 *  strings: JavaScript's Date would round the microseconds. */
export function mergeNewestPage(
  held: ActivityFeedPage | null,
  page: ActivityFeedPage,
): ActivityFeedPage {
  const last = page.items[page.items.length - 1];
  if (!held || !last || !page.next) return page;
  const newestHeld = held.items[0];
  if (!newestHeld || newestHeld.at < last.at) return page;
  const older = held.items.filter((it) => it.at < last.at);
  return older.length > 0
    ? { items: [...page.items, ...older], next: held.next }
    : page;
}

/** How far ahead of the view the next page is asked for. */
const FEED_AHEAD = "600px";
/** Failed page reads in a row before the list stops asking until a refresh. */
const FEED_MORE_TRIES = 3;
const FEED_MORE_RETRY_MS = 2000;

/** Rows the loading band draws: enough to run past the pane's foot, as a
 *  full feed does (each row is 68px). */
const SKELETON_ROWS = 10;

/** One row of the band, empty: the loading list's and the next page's. */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
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
  );
}

/** Loading is the feed it waits for, block for block (Pato, MESITA-2701:
 *  "the placeholders must be similar to the page you are loading, like the
 *  sizes"): the pane with its pb-6, then the same white band as the list (MESITA-2542), each row px-4 py-3 around the 44px face, the
 *  14px sentence and the 12px quiet line 2px under it, the 44px photo. */
function FeedSkeleton() {
  return (
    <div className="bg-card flex-1 pb-6" data-social-loading aria-busy>
      <div className="divide-border border-border bg-card divide-y border-y">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <SkeletonRow key={i} />
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
    | { status: "ready"; items: ActivityFeedItem[]; next: string | null }
  >(() =>
    // Back on Social: the last list repaints at once while it refetches.
    lastFeed
      ? { status: "ready", items: lastFeed.items, next: lastFeed.next }
      : { status: "loading" },
  );
  // Bumped by Try again and pull to refresh: the effect refetches.
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // The events already shown (null before the first load, which glows
  // nothing) and the ones that just arrived.
  const seenRef = useRef<Set<string> | null>(
    lastFeed ? new Set(lastFeed.items.map(eventKey)) : null,
  );
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const freshTimer = useRef<number | undefined>(undefined);
  // The pane, and what the live re-read found and holds behind the banner
  // (MESITA-4083): the page and how many of its events are new.
  const rootRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef<ActivityFeedPage | null>(null);
  const [pendingNew, setPendingNew] = useState(0);
  // The person card is the address (MESITA-3026).
  const router = useRouter();
  const params = useSearchParams();
  // Signed out, no person card draws, even from a ?person= address
  // (MESITA-4325): the tap asks to sign in instead (openPerson).
  const signedOut = useViewer() === "anonymous";
  const cardEvent = params && !signedOut ? cardEventOf(params) : null;
  const cardTab: HistoryTab =
    params?.get("grid") === "saved" ? "saved" : "viewed";
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const scroller = () =>
    rootRef.current?.closest<HTMLElement>("[data-home-scroller]") ?? null;
  // The next page (MESITA-3220): the foot of the list nearing the view asks.
  const footRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const moreFails = useRef(0);
  const [moreRound, setMoreRound] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const refresh = () => {
    setRefreshing(true);
    moreFails.current = 0;
    setGaveUp(false);
    setAttempt((n) => n + 1);
  };
  /** Lays a read in: its events are shown, the new ones glow. */
  const show = (page: ActivityFeedPage) => {
    const keys = page.items.map(eventKey);
    const seen = seenRef.current;
    const arrived = seen ? keys.filter((k) => !seen.has(k)) : [];
    seenRef.current = new Set([...(seen ?? []), ...keys]);
    heldRef.current = null;
    setPendingNew(0);
    if (arrived.length > 0) {
      setFresh(new Set(arrived));
      window.clearTimeout(freshTimer.current);
      freshTimer.current = window.setTimeout(
        () => setFresh(new Set()),
        FRESH_MS,
      );
    }
    // Read now, not at the ask: a page may have landed since. Another
    // location's rows are never kept.
    const merged = mergeNewestPage(
      lastFeed?.fromKey === fromKey ? lastFeed : null,
      page,
    );
    lastFeed = { ...merged, fromKey };
    setState({ status: "ready", ...merged });
  };

  useEffect(() => {
    let cancelled = false;
    // live: the 30-second re-read, which holds new events behind the banner
    // (MESITA-4083); the first read of the effect lays its page in.
    const load = (live: boolean) =>
      apiListActivityFeed(
        supabase,
        from ? { lat: from.lat, lng: from.lng } : null,
      )
        .then((page) => {
          if (cancelled) return;
          const seen = seenRef.current;
          const arrived = seen
            ? page.items.filter((it) => !seen.has(eventKey(it))).length
            : 0;
          if (live && arrived > 0) {
            heldRef.current = page;
            setPendingNew(arrived);
          } else if (!live || heldRef.current == null) {
            show(page);
          }
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
    load(false);
    // Live: ask again while the tab is in view (MESITA-2532).
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, LIVE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fromKey, attempt]);

  useEffect(() => () => window.clearTimeout(freshTimer.current), []);

  const next = state.status === "ready" ? state.next : null;
  useEffect(() => {
    const el = footRef.current;
    if (!next || gaveUp || !el) return;
    let cancelled = false;
    const settle = () => {
      loadingMore.current = false;
      if (!cancelled) setMoreRound((n) => n + 1);
    };
    const io = new IntersectionObserver(
      (seen) => {
        if (!seen.some((e) => e.isIntersecting) || loadingMore.current) return;
        loadingMore.current = true;
        apiListActivityFeed(
          supabase,
          from ? { lat: from.lat, lng: from.lng } : null,
          next,
          undefined,
          // The feed ends at Admin's latest-events number (MESITA-4572).
          lastFeed?.items.length ?? 0,
        )
          .then((page) => {
            moreFails.current = 0;
            // The location moved, or a refresh restarted the list: this page
            // no longer follows what is held.
            if (lastFeed?.fromKey === fromKey && lastFeed.next === next) {
              const held = new Set(lastFeed.items.map(eventKey));
              const items = [
                ...lastFeed.items,
                ...page.items.filter((it) => !held.has(eventKey(it))),
              ];
              lastFeed = { items, next: page.next, fromKey };
              seenRef.current = new Set([
                ...(seenRef.current ?? []),
                ...items.map(eventKey),
              ]);
              setState({ status: "ready", items, next: page.next });
            }
            settle();
          })
          .catch((err) => {
            console.warn(
              "social_feed_page_failed",
              errMsg(err, "consumer-web-list-activity failed"),
            );
            moreFails.current += 1;
            if (moreFails.current >= FEED_MORE_TRIES) setGaveUp(true);
            setTimeout(settle, FEED_MORE_RETRY_MS);
          });
      },
      // The root is Home's scroller: a margin on the viewport would not reach
      // past the scroller's own clipping.
      { root: scroller(), rootMargin: `${FEED_AHEAD} 0px` },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, moreRound, gaveUp, fromKey, supabase]);

  // A FLOATING CARD OVER THE FEED (Pato, 2026-11-21, MESITA-4629: "profile
  // of people must be also a floating modal", the Categories modal's). The
  // open card is the feed's own address, ?person=… on /home/social
  // (MESITA-3026), so a place tapped in it pushes over the feed and Back
  // finds the card open again; the X pops. The card keeps its last event
  // through the closing fade. /home/social/person stays a page for old links.
  const [shownCard, setShownCard] = useState<CardEvent | null>(null);
  if (cardEvent && (!shownCard || cardKey(cardEvent) !== cardKey(shownCard))) {
    setShownCard(cardEvent);
  }
  const personModal = (
    <LocalDialog
      open={cardEvent !== null}
      onClose={() => goBack(router)}
      ariaLabel="Profile"
      scroll
    >
      <PersonCard
        event={cardEvent ?? shownCard}
        fallback={null}
        tab={cardTab}
        onTab={(t) => {
          const e = cardEvent ?? shownCard;
          if (e)
            router.replace(cardHref(CONSUMER_ROUTES.homeSocial, e, t), {
              scroll: false,
            });
        }}
        onClose={() => goBack(router)}
      />
    </LocalDialog>
  );

  const openPerson = (it: ActivityFeedItem) => {
    // Signed out, the sign modal — never the profile (Pato, MESITA-4325).
    const href = cardHref(CONSUMER_ROUTES.homeSocial, it, "viewed");
    if (signedOut) {
      openSignGate(href, null);
      return;
    }
    router.push(href);
  };

  if (state.status === "loading") {
    return <FeedSkeleton />;
  }
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
  const rows = state.items;
  const more = next != null && !gaveUp;
  if (rows.length === 0 && !more) {
    return (
      <EmptyState
        icon={Users}
        title="No activity yet"
        description="When members like or view a place, it shows up here."
      />
    );
  }
  return (
    <div
      ref={rootRef}
      className="bg-card flex-1 pb-6"
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
      {personModal}
      {/* THE NEW-EVENTS BANNER (Pato, MESITA-4715: "below social maybe a
          blue banner that says 0 new events … and button to reload"): always
          drawn between the tabs and the rows, sticky. Reload lays the held
          events in and goes to the top; with none held it reads again.
          NEUTRAL, NOT BLUE (Pato, 2026-11-23, MESITA-4761: "that blue to
          reload is repulsive"): white with a hairline, muted words and a grey
          pill; new events waiting turn the words ink and the pill black.
          DARK (Pato, 2026-11-23, MESITA-4786: "the reload bar must be kind
          dark"): an ink bar, soft white words, a translucent white pill; new
          events waiting turn the words white and the pill solid white. */}
      <div
        className="bg-foreground sticky top-0 z-10 flex h-11 items-center gap-3 pr-2 pl-5"
        data-social-new-banner
      >
        <p
          className={cn("min-w-0 flex-1 truncate text-sm font-semibold", pendingNew === 0 ? "text-background/70" : "text-background")}
          aria-live="polite"
        >
          {pendingNew === 0
            ? "No new events"
            : `${pendingNew} new ${pendingNew === 1 ? "event" : "events"}`}
        </p>
        <button
          type="button"
          onClick={() => {
            if (heldRef.current) show(heldRef.current);
            else if (!refreshing) refresh();
            scroller()?.scrollTo({ top: 0 });
          }}
          className={cn(
            "focus-visible:ring-ring flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold outline-none focus-visible:ring-2",
            pendingNew === 0 ? "bg-background/15 text-background hover:bg-background/25" : "bg-background text-foreground",
          )}
        >
          <RotateCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
            strokeWidth={2.25}
            aria-hidden
          />
          Reload
        </button>
      </div>
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
      <ul
        role="list"
        aria-label="Social"
        className="divide-border border-border bg-card divide-y border-y"
      >
        {rows.map((item) => (
          <FeedRow
            key={eventKey(item)}
            item={item}
            fresh={fresh.has(eventKey(item))}
            onPerson={openPerson}
          />
        ))}
        {more && (
          <li aria-hidden data-social-more>
            <div ref={footRef}>
              <SkeletonRow />
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
