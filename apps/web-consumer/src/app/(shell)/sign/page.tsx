import { cache } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { redirect } from "next/navigation";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { CoverAuthLayout } from "@/components/auth/CoverAuthLayout";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OnboardForm, type OnboardInitialValues } from "@/app/onboard/OnboardForm";
import {
  consumerAuthDestination,
  giftTokenFromNext,
  payPlaceFromNext,
  safeNextPath,
} from "@/lib/auth-redirect";
import { apiGetGiftPreview, apiGetPayPlaceName } from "@/lib/api/auth";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { birthYearOf, consumerCanBrowse, joinName } from "@/lib/consumer-onboarding";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { signIntentFromNext } from "@/lib/sign-intent";
import { isTransientAuthError } from "@/lib/stale-session";
import { errMsg } from "@/lib/utils";

// THE SIGN TAB (MESITA-4246, Pato 2026-11-17: "ya que le picas sign, ahí se
// crea la cuenta, o sea, en esa misma página y dejas el menú abajo
// mostrado"). One page, the bar showing under it, three states decided
// here on the server (the proxy cannot see onboarding):
//
//   no session              → the phone code (PhoneOtpForm)
//   signed in, not onboarded → the onboarding form
//   onboarded               → `next`, or Me
//
// It replaces `/` as the sign-in page: a signed-out `/` opens Home now. The
// headline says why the visitor is here, read from `next` (sign-intent.ts),
// and a friend's gift link keeps its card (MESITA-4229).

export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ next?: string }> };

// A friend's gift link: one read per request serves the page and its
// metadata; a failure is the plain Sign.
const readGift = cache(async (next: string | undefined) => {
  const token = giftTokenFromNext(next);
  if (!token) return null;
  const preview = await apiGetGiftPreview(await createServerSupabase(), token);
  if (!preview) return null;
  const amount = moneyLabel(preview.amount_cents, preview.currency);
  return {
    line: preview.placeName
      ? `${amount} of credit at ${preview.placeName}`
      : `${amount} of credit`,
  };
});

export async function generateMetadata(
  { searchParams }: Params,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const gift = await readGift((await searchParams).next);
  if (!gift) return {};
  const description = "From a friend on Mesita. Sign in to take it.";
  const { openGraph, twitter } = await parent;
  return {
    title: gift.line,
    description,
    openGraph: { ...openGraph, title: gift.line, description } as Metadata["openGraph"],
    twitter: { ...twitter, title: gift.line, description } as Metadata["twitter"],
  };
}

export default async function SignPage({ searchParams }: Params) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user && isTransientAuthError(userError)) throw userError;

  if (user && !user.is_anonymous) {
    // A failed profile read is not "not onboarded" (MESITA-4246, E12): a
    // retry, never the form, so an onboarded guest cannot overwrite their
    // profile on a bad read.
    let onboarded = false;
    let initial: OnboardInitialValues | undefined;
    let failed = false;
    try {
      const { consumer: profile } = await apiFetchConsumerProfile(supabase);
      onboarded = consumerCanBrowse(profile);
      initial = {
        name: joinName(profile.first_name, profile.last_name) || (profile.full_name ?? ""),
        birthYear: birthYearOf(profile),
        sex: profile.sex ?? "",
      };
    } catch (err) {
      console.error("[consumer/sign] consumer-get-profile:", errMsg(err, "profile fetch failed"));
      failed = true;
    }
    if (onboarded) redirect(next ?? CONSUMER_ROUTES.me);
    if (failed) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-foreground text-base font-semibold">We couldn&apos;t load your account</p>
          <a
            href={params.next ? `${CONSUMER_ROUTES.sign}?next=${encodeURIComponent(next ?? "")}` : CONSUMER_ROUTES.sign}
            className="text-foreground min-h-11 font-medium underline underline-offset-2"
          >
            Try again
          </a>
        </div>
      );
    }
    const identity = user.phone || user.email || null;
    return (
      <div className="scrollbar-thin-dark flex flex-1 flex-col overflow-y-auto px-6 pt-8 pb-8">
        <OnboardForm initial={initial} next={next} />
        <div className="text-muted-foreground mt-5 flex items-center justify-between gap-3 text-xs">
          <span className="truncate">{identity ?? "Your account"}</span>
          <SignOutButton
            redirectTo={CONSUMER_ROUTES.sign}
            label="Not you? Use another number"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 items-center font-medium underline underline-offset-2 transition"
          />
        </div>
      </div>
    );
  }

  // The phone step. Pay QR and gift links keep the lines they had on `/`.
  const payPlaceId = payPlaceFromNext(next);
  const payPlaceName = payPlaceId
    ? await apiGetPayPlaceName(supabase, payPlaceId).catch(() => null)
    : null;
  const gift = payPlaceName ? null : await readGift(next ?? undefined);
  const intent = signIntentFromNext(next);

  return (
    <CoverAuthLayout
      headline={
        payPlaceName
          ? `Pay at ${payPlaceName}`
          : gift
            ? "Credit from a friend"
            : intent.headline
      }
      title={
        payPlaceName
          ? `Sign in to pay at ${payPlaceName}`
          : gift
            ? `${gift.line}. Sign in to take it.`
            : intent.title
      }
      footer={
        <>
          By continuing you agree to Mesita&apos;s terms of service and privacy
          policy. SMS rates may apply.
        </>
      }
    >
      <PhoneOtpForm redirectAfter={consumerAuthDestination(next ?? undefined)} />
    </CoverAuthLayout>
  );
}
