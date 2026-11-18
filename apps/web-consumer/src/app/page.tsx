import { cache } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { GIFT_PREVIEW_PAGE_TIMEOUT_MS, giftLine, giftMetadata, giftSignTitle } from "@/lib/gift-link-card";
import { redirect } from "next/navigation";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { CoverAuthLayout } from "@/components/auth/CoverAuthLayout";
import {
  consumerAuthDestination,
  giftTokenFromNext,
  payPlaceFromNext,
} from "@/lib/auth-redirect";
import { apiGetGiftPreview, apiGetPayPlaceName } from "@/lib/api/auth";

// Root of the consumer subdomain. Strong routing contract:
//
//   no session              → render auth (this page)
//   session + verify        → /auth/post-signin (?next= deep link)
//   post-signin             → /onboard or ?next= target
//
// A phone code collapses sign-in and create-account into one flow. Phone is
// the only way in (MESITA-3875, Pato: "Only Auth with Phone number must be
// enabled for consumers"): Continue with Google and the email code are gone.

export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ next?: string }> };

// A FRIEND'S GIFT LINK (MESITA-4229). A signed-out friend who taps
// /wallet/gift/<token> lands here with `?next=`, and so does the crawler
// that draws the link's card in WhatsApp. Both used to see "Restaurants,
// from your phone", which reads as an ad; now the page and the card say what
// the link holds: "$200.00MX of credit at Orinoco. Sign in to take it." One
// read per request (cache) serves the page and its metadata; any failure,
// or no answer in 1.5s, is today's plain sign-in.
const readGift = cache(async (next: string | undefined) => {
  const token = giftTokenFromNext(next);
  if (!token) return null;
  const preview = await apiGetGiftPreview(await createServerSupabase(), token, GIFT_PREVIEW_PAGE_TIMEOUT_MS);
  if (!preview) return null;
  const amount = moneyLabel(preview.amount_cents, preview.currency);
  return {
    line: giftLine(amount, preview.placeName, preview.claimed),
    // A claimed link says so (MESITA-4367).
    claimed: preview.claimed,
    // The link's card (MESITA-4363): the gift's token and its sender.
    token,
    senderName: preview.senderName,
  };
});

export async function generateMetadata(
  { searchParams }: Params,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const gift = await readGift((await searchParams).next);
  if (!gift) return {};
  const { openGraph, twitter } = await parent;
  return giftMetadata(gift, { openGraph, twitter });
}

export default async function ConsumerRootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const afterAuth = consumerAuthDestination(params.next);

  if (user) {
    redirect(afterAuth);
  }

  // The Pay QR door (MESITA-3526): a table QR's `/pay?place=<id>` names the
  // place. A failed or empty read keeps the plain title; sign-in never waits
  // on it to work.
  const payPlaceId = payPlaceFromNext(params.next);
  const payPlaceName = payPlaceId
    ? await apiGetPayPlaceName(supabase, payPlaceId).catch(() => null)
    : null;
  const gift = payPlaceName ? null : await readGift(params.next);

  return (
    <CoverAuthLayout
      headline={
        payPlaceName
          ? `Pay at ${payPlaceName}`
          : gift
            ? "Credit from a friend"
            : "Discover your next favorite place."
      }
      title={
        payPlaceName
          ? `Sign in to pay at ${payPlaceName}`
          : gift
            ? giftSignTitle(gift)
            : undefined
      }
      footer={
        <>
          By continuing you accept the Terms and Privacy Policy. SMS rates may
          apply.
        </>
      }
    >
      <PhoneOtpForm redirectAfter={afterAuth} />
    </CoverAuthLayout>
  );
}
