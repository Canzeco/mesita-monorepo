"use client";

// THE PLACE'S BARE ADDRESS IS A HAND-OFF NOW (MESITA-1988).
//
// Pato: *"place is not activity shit. fuck that. place is just to search places
// and to select them and claim it… so you have multiple places there and you
// can switch from place a to place b there."*
//
// This was HOME: an Ask bar, the blockers, four counts and the last five events.
// None of that is what the Place tab means — Place is the switcher, and a
// switcher that lands you on a dashboard has made a second decision for you.
//
// WHERE THE CONTENT WENT, rather than what was deleted: the Ask bar, the
// blockers and the counts are on ACTIVITY's default pane, above the log they
// were already previewing. That is the screen those three were always about —
// what needs you, and what happened.
//
// THE ADDRESS SURVIVES because things point at it: a pasted link, `/home`, the
// catalogue's own rows, and Stripe's stored `?connect=` return. It resolves to
// this place's Products rather than 404ing, and the Stripe hand-off still wins
// because that query is the one thing this address means on its own.
import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { placePageHref, placePayHref } from "@/lib/console-routes";

export default function PlaceRoot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const connect = useSearchParams().get("connect");

  useEffect(() => {
    // STRIPE FIRST. An Account Link's `return_url` is minted weeks before it is
    // followed, so this query can arrive long after the owner left, and it is
    // the only reason this address has a meaning of its own.
    router.replace(
      connect
        ? `${placePayHref(id)}?connect=${encodeURIComponent(connect)}`
        : placePageHref(id, "products"),
    );
  }, [id, connect, router]);

  return (
    <p className="text-muted-foreground text-sm" role="status">
      Opening…
    </p>
  );
}
