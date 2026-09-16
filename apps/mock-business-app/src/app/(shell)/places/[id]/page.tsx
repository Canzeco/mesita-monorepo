"use client";

// THE BARE PLACE ADDRESS IS A 307 ONTO PROFILE, and it is the one address that
// also catches Stripe's stored return.
//
// Stripe stores an Account Link's `return_url` at the moment the link is
// MINTED, so an owner can come back to an address that was written weeks ago.
// This page hands the whole query on to the place's Payments setup rather than
// dropping it — an owner who just spent eight minutes uploading documents must
// not land on a screen that does not know they came back.
import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

export default function PlaceRoot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const connect = search.get("connect");

  useEffect(() => {
    router.replace(
      connect ? `${placePayHref(id)}?connect=${encodeURIComponent(connect)}` : placeTabHref(id, "profile"),
    );
  }, [id, connect, router]);

  return (
    <p className="text-muted-foreground text-sm" role="status">
      Opening…
    </p>
  );
}
