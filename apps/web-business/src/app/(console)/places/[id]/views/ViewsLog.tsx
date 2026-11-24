"use client";

// Who viewed, liked and shared (MESITA-3213; the whole Views page since
// MESITA-4538, a signed-in viewer's name links to Customers, Pato: "the list of logs is super
// important, also mentioning who say what ... based that kinda of the current
// social feed"). Social's row without the place's photo, since the page is one
// place: the guest's face with the Instagram mark (no VIP crown since
// MESITA-4709), the name, the verb, and under
// it their Instagram and the time. What the server sends is Social's rule: a
// signed-out view or a guest without a verified, shown Instagram has no
// handle; only a signed-out view has no photo (every profile is public,
// MESITA-4690).

import { useState } from "react";
import Link from "next/link";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { Card } from "@/components/shell/Page";
import { listPlaceViewsLog, type PlaceViewEvent, type PlaceViewsLog } from "@/lib/business-api";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { customerHref, customerLabel } from "@/lib/monitor";
import { CHIP, FilterBanner } from "@/components/place-manage/MonitorList";
import { cn } from "@/lib/utils";
import { attempt } from "@/lib/attempt";

const VERB: Record<PlaceViewEvent["kind"], string> = {
  viewed: "viewed",
  saved: "liked",
  shared: "shared",
};

const ROW = "flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5";
const MARK = "ring-card absolute -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2";

/** "1.2K followers". */
function followersLine(n: number): string | null {
  if (n <= 0) return null;
  const text = n < 1000 ? String(n) : `${String(Math.round(n / 100) / 10).replace(/\.0$/, "")}K`;
  return `${text} ${n === 1 ? "follower" : "followers"}`;
}

function when(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function Face({ person }: { person: PlaceViewEvent["person"] }) {
  return (
    <span className="relative block h-8 w-8 shrink-0">
      {person.avatarUrl ? (
        <SizedImg src={person.avatarUrl} size="thumb" alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="block h-8 w-8 overflow-hidden rounded-full">
          <DefaultAvatar className="h-full w-full" />
        </span>
      )}
      {person.instagram ? (
        <span
          aria-hidden
          className={cn(MARK, "-left-1 bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-2.5 w-2.5">
            <rect width="20" height="20" x="2" y="2" rx="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <path d="M17.5 6.5h.01" />
          </svg>
        </span>
      ) : null}
    </span>
  );
}

function EventRow({ placeId, event, timezone }: { placeId: string; event: PlaceViewEvent; timezone: string }) {
  const { person } = event;
  const followers = followersLine(person.followers);
  return (
    <li className={ROW}>
      <Face person={person} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {event.customer ? (
            <Link href={customerHref(placeId, event.customer)} className="font-medium hover:underline underline-offset-2">
              {person.name}
            </Link>
          ) : (
            <span className="font-medium">{person.name}</span>
          )}{" "}
          {VERB[event.kind]}
        </span>
        <span className="text-muted-foreground">
          {person.handle ? (
            <>
              <a
                href={`https://www.instagram.com/${encodeURIComponent(person.handle)}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline underline-offset-2"
              >
                @{person.handle}
              </a>
              {" · "}
            </>
          ) : null}
          {followers ? `${followers} · ` : null}
          <span className="whitespace-nowrap">{when(event.at, timezone)}</span>
        </span>
        {event.customer ? (
          <Link href={customerHref(placeId, event.customer)} className={cn(CHIP, "gap-1")}>
            <UserCircleIcon size={12} weight="bold" aria-hidden />
            {customerLabel(event.customer)}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function ViewsLog({
  placeId,
  timezone,
  initial,
  customer = null,
}: {
  placeId: string;
  timezone: string;
  initial: PlaceViewsLog;
  customer?: string | null;
}) {
  const [events, setEvents] = useState(initial.events);
  const [next, setNext] = useState(initial.next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!next) return;
    setBusy(true);
    setError(null);
    const r = await attempt(listPlaceViewsLog(placeId, next, customer));
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEvents((all) => [...all, ...r.data.events]);
    setNext(r.data.next);
  }

  return (
    <Card className="flex min-w-0 flex-col p-0 sm:p-0">
      {customer ? (
        <FilterBanner text={`Showing ${events[0]?.person.name ?? "this guest"}'s views`} clearHref={`/places/${encodeURIComponent(placeId)}/views`} />
      ) : null}
      <ul className="divide-border divide-y">
        {events.length === 0 ? (
          <li className={cn(ROW, "text-muted-foreground")}>{customer ? "Nothing matches this filter." : "No views yet."}</li>
        ) : null}
        {events.map((event, i) => (
          <EventRow key={`${i}|${event.kind}|${event.at}`} placeId={placeId} event={event} timezone={timezone} />
        ))}
        {next ? (
          <li className={ROW}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void more()}
              className="border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40"
            >
              {busy ? "Loading…" : "Show more"}
            </button>
          </li>
        ) : null}
      </ul>
      {error ? <p className={cn(ERROR_BOX_CLASS, "mx-5 mb-4 sm:mx-6")}>{error}</p> : null}
    </Card>
  );
}
