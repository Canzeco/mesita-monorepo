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
// One line: the name (bold), the verb, the place (bold), no period; under
// it, muted, the Instagram glyph and the member's Instagram as social proof —
// the full @handle (MESITA-2590) and an approximate follower count — then
// the time. You see others' handles only if you show yours (MESITA-2594):
// without your own Instagram verified and your profile public, the server
// sends "@per***" instead. No Instagram → the quiet line is the time alone.
// The place's photo on the right; no photo → the card placeholder (family
// icon or initial), never an empty box. Two verbs — liked (stored `saved`)
// and viewed (stored `viewed`); the labels changed, never the keys. There is
// no visited (Pato, MESITA-2567: "there is only viewed and liked").
// ONE PERSON, ONE PLACE, ONE EVENT per row, never "and 4 others" (Pato,
// MESITA-2532: "is juse one person one place events. list all the fucking
// events. its readl time uner you radious or near you, just enough to odn't
// kill"): the server returns every event inside the operator's Area circle
// around the guest, newest first, at most 50, and the pane refetches every
// LIVE_MS while the tab is visible. EVERY MEMBER IS NAMED BY FIRST NAME
// (Pato, MESITA-2612: "who the fuck is a member, remove that shit"; it
// retires MESITA-2580's and MESITA-2594's "A member"). The Instagram proof
// rides only on a like by a member with a verified Instagram and a public
// profile (MESITA-2594: a view carries no handle). NO MOCK DATA
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
// and the history scrolls with no bar drawn over its photos ("fix the
// scrolling bar").

import { useEffect, useRef, useState, type SVGProps } from "react";
import Link from "next/link";
import { ArrowUp, Crown, RotateCw, Users, X } from "lucide-react";
import { DefaultAvatar } from "@mesita/place-profile";
import { Instagram } from "@/components/shared/instagram-icon";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  apiListActivityFeed,
  apiMemberHistory,
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
import { EmptyState } from "@/components/shared";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { IdentityCard } from "@/components/consumer/IdentityCard";
import { toGuestClass, toGuestPlan } from "@/lib/guest-standing";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn, errMsg } from "@/lib/utils";
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

/** Who leads the line: "You", else the member's name. */
export function feedWho(lead: ActivityPerson): string {
  if (lead.isYou) return "You";
  return lead.name;
}

/** The Instagram proof on a row's quiet line ("@perdon · 1.2K followers";
 *  the glyph before it says Instagram), plain text, never a link, or null
 *  without a named Instagram (or for the guest's own row). The full handle
 *  since MESITA-2590, or "@per***" when the viewer does not show their own
 *  (MESITA-2594; the server masked it). */
export function feedInstagram(lead: ActivityPerson): string | null {
  const handle = lead.isYou || !lead.handle ? null : `@${lead.handle}`;
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.avatarUrl}
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
 *  its 44px size and the photo renders full size (MESITA-2544). */
function Thumb({ place }: { place: Place }) {
  const photo = cardPhoto(place);
  if (photo) {
    return (
      <span className="bg-muted block h-11 w-11 shrink-0 overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const placeholder = placePlaceholder(place);
  return (
    <span
      className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
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
  const instagram = feedInstagram(item.person);
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
        "flex items-center gap-3 px-4 py-3 transition-colors duration-1000",
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
        className="focus-visible:ring-ring block shrink-0 rounded-lg outline-none focus-visible:ring-2"
        data-social-place
      >
        <Thumb place={item.place} />
      </Link>
    </li>
  );
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
function useMemberHistory(
  item: ActivityFeedItem | null,
  open: boolean,
): MemberHistory | null {
  const supabase = useBrowserSupabase();
  const key = item ? eventKey(item) : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    history: MemberHistory;
  } | null>(null);
  useEffect(() => {
    if (!open || !item || !key) return;
    let cancelled = false;
    apiMemberHistory(supabase, item)
      .then((history) => {
        if (!cancelled) setLoaded({ key, history });
      })
      .catch((err) => {
        console.error(
          "social_member_history_failed",
          errMsg(err, "consumer-web-list-activity failed"),
        );
        if (!cancelled) {
          setLoaded({ key, history: { person: null, items: [] } });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key, open]);
  return loaded && loaded.key === key ? loaded.history : null;
}

/** The card's Instagram box, Me's own wording (MESITA-2606): "Insta: @handle
 *  · 1.2K followers", a masked "Insta: @per***", or "Insta: not connected".
 *  On your own card the handle shows too. */
function cardInstagramLabel(person: ActivityPerson): string {
  if (!person.handle) return "Insta: not connected";
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
 *  it. The route sheets' close disc sits in its top-right corner, inset by
 *  the card's own padding (MESITA-2681); the backdrop and Escape still
 *  close it too. */
function PersonCard({
  item,
  open,
  onClose,
}: {
  item: ActivityFeedItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const history = useMemberHistory(item, open);
  const { igConnected } = useConsumerIdentity();
  if (!item) return null;
  const person = history?.person ?? item.person;
  const who = feedWho(person);
  const igUrl =
    person.handle && !person.isYou && !person.handleLocked
      ? `https://www.instagram.com/${encodeURIComponent(person.handle)}/`
      : null;
  return (
    <LocalDialog
      open={open}
      onClose={onClose}
      ariaLabel={`${who}'s profile`}
      instant
    >
      <div className="p-5" data-social-person-card>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="border-border bg-card text-foreground hover:bg-muted absolute top-5 right-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border transition"
          data-social-person-close
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        <IdentityCard
          name={who}
          avatarUrl={person.avatarUrl}
          instagram={{ label: cardInstagramLabel(person) }}
          guestClass={toGuestClass(person.guestClass)}
          plan={toGuestPlan(person.plan)}
        />
        {/* ONE HAIRLINE, EDGE TO EDGE, between the identity boxes and the
            history (Pato, MESITA-2611: "this activity feed must be divided
            by a line, like in instagram"): the way Instagram's profile
            rules off the header from the grid. The line spans the card
            (-mx-5 undoes the card's padding) and is there in every state,
            rows, skeleton or "No activity yet". */}
        <div
          className="border-border -mx-5 mt-4 border-t px-5"
          data-social-history-divider
        >
          <HistoryList items={history ? history.items : null} />
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
        {person.handleLocked && !person.isYou && (
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

/** The card's one list (MESITA-2609): the member's history, one row per
 *  event, the feed row's own shape without the face — "liked Contramar",
 *  the time under it, the place's photo on the right — each a door to the
 *  place. Scrolls inside the card with no bar, the app's every scroller
 *  (the browser's bar sat over the photos, MESITA-2681), and a fling at
 *  either end stays in the card instead of scrolling Home behind it. */
function HistoryList({ items }: { items: MemberHistoryItem[] | null }) {
  if (items == null) {
    return (
      <div className="mt-3 space-y-2" aria-busy data-social-history-loading>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p
        className="text-muted-foreground mt-3 text-center text-sm"
        data-social-history-empty
      >
        No activity yet
      </p>
    );
  }
  return (
    <ul
      role="list"
      aria-label="Activity"
      className="divide-border scrollbar-hide max-h-[45vh] divide-y overflow-y-auto overscroll-y-contain"
      data-social-history
    >
      {items.map((it) => (
        <li key={`${it.placeId}|${it.kind}|${it.at}`}>
          <Link
            href={placeHref(it.place.slug || it.place.id)}
            className="focus-visible:ring-ring flex items-center gap-3 py-2.5 outline-none focus-visible:ring-2"
            data-social-history-event={it.kind}
          >
            <span className="min-w-0 flex-1">
              <span className="text-foreground line-clamp-2 text-sm leading-snug">
                {VERB[it.kind]}{" "}
                <span className={LINK_WORD_CLASS}>{it.place.name}</span>
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {shortAgo(it.at)}
              </span>
            </span>
            <Thumb place={it.place} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Loading looks like the rows it waits for. */
function FeedSkeleton() {
  return (
    <div className="bg-background flex-1 pt-14" data-social-loading aria-busy>
      {/* The same white band as the list (MESITA-2542), so nothing jumps. */}
      <div className="divide-border border-border bg-card divide-y border-y">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SocialFeed() {
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
  const [personItem, setPersonItem] = useState<ActivityFeedItem | null>(null);
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
  const rows = state.items;
  const openPerson = (it: ActivityFeedItem) => {
    setPersonItem(it);
    setPersonOpen(true);
  };
  if (rows.length === 0) {
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
      <PersonCard
        item={personItem}
        open={personOpen}
        onClose={() => setPersonOpen(false)}
      />
    </div>
  );
}
