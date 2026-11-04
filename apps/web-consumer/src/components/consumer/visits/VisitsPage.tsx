"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Store } from "lucide-react";
import { SizedImg } from "@mesita/place-profile";
import { EmptyState, Skeleton } from "@/components/shared";
import { apiListVisits, type GuestVisit } from "@/lib/api/rewards";
import { CONSUMER_ROUTES, placePath } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// ME › VISITS (Pato, MESITA-3264: "there we are going to save the history of
// visits"). Every visit staff closed for this guest, newest first, in Social's white
// band. Each row says what the guest paid; the amounts are the ones the server worked
// out at the close, and a row opens the place.

const BAND = "divide-border border-border bg-card divide-y border-y";

function money(cents: number, currency: string): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function VisitRow({ visit }: { visit: GuestVisit }) {
  return (
    <Link href={placePath(visit.place_id)} className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition">
      <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
        {visit.photo ? (
          <SizedImg src={visit.photo} size="thumb" alt="" className="h-full w-full object-cover" />
        ) : (
          <Store className="h-5 w-5" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{visit.place_name ?? "A place on Mesita"}</span>
        <span className="text-muted-foreground block truncate text-sm">{day(visit.created_at)}</span>
      </span>
      <span className="shrink-0 text-right tabular-nums">
        <span className="block text-sm font-semibold">{money(visit.total_cents, visit.currency)}</span>
        {visit.discount_cents > 0 ? (
          <span className="text-fact-reward block text-sm font-semibold">−{money(visit.discount_cents, visit.currency)}</span>
        ) : null}
      </span>
    </Link>
  );
}

function VisitRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </span>
      <Skeleton className="h-3.5 w-16 shrink-0" />
    </div>
  );
}

export function VisitsSkeleton() {
  return (
    <div className={BAND} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <VisitRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function VisitsPage() {
  const supabase = useBrowserSupabase();
  const [visits, setVisits] = useState<GuestVisit[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [more, setMore] = useState(false);

  useEffect(() => {
    let live = true;
    apiListVisits(supabase).then(
      (page) => {
        if (!live) return;
        setVisits(page.visits);
        setNext(page.next);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, attempt]);

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const page = await apiListVisits(supabase, next);
      setVisits((now) => [...(now ?? []), ...page.visits]);
      setNext(page.next);
    } catch {
      // The button stays, so the guest can try again.
    }
    setMore(false);
  }

  if (failed && !visits) {
    return (
      <EmptyState
        icon={QrCode}
        title="Your visits didn't load"
        description="Check your connection and try again."
        action={{
          label: "Try again",
          onClick: () => {
            setFailed(false);
            setAttempt((n) => n + 1);
          },
        }}
      />
    );
  }
  if (!visits) return <VisitsSkeleton />;
  if (visits.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No visits yet"
        description="When staff scan your QR at a place, the visit lands here."
        action={{ label: "See rewards", href: CONSUMER_ROUTES.pay }}
      />
    );
  }
  return (
    <>
      <ul role="list" aria-label="Visits" className={BAND}>
        {visits.map((visit) => (
          <li key={visit.id}>
            <VisitRow visit={visit} />
          </li>
        ))}
      </ul>
      {next ? (
        <button type="button" disabled={more} onClick={() => void loadMore()} className="text-muted-foreground mt-3 min-h-11 w-full text-sm underline disabled:opacity-60">
          {more ? "Loading…" : "Show more"}
        </button>
      ) : null}
    </>
  );
}
