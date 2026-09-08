import Link from "next/link";
import { Ban, Gift as GiftIcon, ShieldAlert } from "lucide-react";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { formatCurrency } from "@/lib/api/profile";
import { fetchGiftPreview } from "@/lib/api/gift-public";
import { withNext } from "@/lib/auth-redirect";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { PIN_LENGTH } from "@/components/consumer/PinField";

// /gift/[code] — the PUBLIC gift landing page (MESITA-1677).
//
// THE ONE ROUTE OUTSIDE (shell) THIS ISSUE ADDS. `(shell)/layout.tsx`'s
// getUser() is a segment-wide auth wall, and route-structure.test.tsx's T1
// permits exactly the pages named there — this is now the fourth. A
// recipient who has never heard of Mesita would hit OTP before a single
// pixel of the org's identity rendered otherwise, which would destroy the
// entire acquisition value of gifting. The shape this proves is
// apps/web-validate's: a public route, server-rendered, a possession code in
// the URL as the whole authentication (gift-web-preview-code, verify_jwt =
// false).
//
// ORDER, PER THE ISSUE'S OWN INSTRUCTION: org identity leads, then the
// amount. If the lot were still pending (a hold), that would be said BEFORE
// the accept CTA — checked below via `gift.pending`, always false today
// (credits activate immediately, no hold — consumer-web-buy-credits' own
// 2026-09-08 decision applies identically here) but rendered defensively so
// the day a hold returns this page already tells the truth about it.
//
// SIGN-IN IS STEP TWO. The CTA below carries `?next=` through `/` (sign-in)
// -> `/auth/post-signin` -> `/new-visit/wallet/redeem?code=...`, which
// RedeemClient already reads server-side and prefills (unchanged by this
// issue — MESITA-1692 built that half explicitly so this page would only
// ever have to forward one query param).
//
// NO ORG LOGO — organizations has no logo/photo column in the schema at all
// (checked directly before writing this). A text monogram substitutes; a
// real image is a Design/asset-pipeline decision this issue does not scope.

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <MobileFrame>
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
        {children}
      </div>
    </MobileFrame>
  );
}

function Unavailable({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Ban;
  title: string;
  description: string;
}) {
  return (
    <Shell>
      <div className="bg-muted text-muted-foreground mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
        {description}
      </p>
      <Link
        href="/"
        className="text-primary mt-6 text-sm font-semibold underline underline-offset-4"
      >
        Go to Mesita
      </Link>
    </Shell>
  );
}

export default async function GiftLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.replace(/\D/g, "").slice(0, PIN_LENGTH);

  if (code.length !== PIN_LENGTH) {
    return (
      <Unavailable
        icon={Ban}
        title="That's not a gift link"
        description="Check the link you were sent — it may be missing digits or damaged in transit."
      />
    );
  }

  const result = await fetchGiftPreview(code);

  if (!result.ok) {
    if (result.status === 404) {
      return (
        <Unavailable
          icon={Ban}
          title="Gift not found"
          description="This link doesn't match a gift we know about. Ask whoever sent it to double-check the code."
        />
      );
    }
    return (
      <Unavailable
        icon={ShieldAlert}
        title="Mesita isn't responding"
        description="Something went wrong on our end. Try opening this link again in a moment."
      />
    );
  }

  const { gift } = result;

  if (gift.state === "claimed") {
    return (
      <Unavailable
        icon={GiftIcon}
        title="Already claimed"
        description="This gift code has already been used. If that wasn't you, ask whoever sent it for a new one."
      />
    );
  }

  if (gift.state === "cancelled") {
    return (
      <Unavailable
        icon={Ban}
        title="This gift was cancelled"
        description="Whoever sent it took the balance back before it was claimed. Ask them for a new gift if this was a mistake."
      />
    );
  }

  const claimHref = withNext(
    "/",
    `${CONSUMER_ROUTES.newVisit.walletRedeem}?code=${code}`,
  );

  return (
    <Shell>
      {/* ORG IDENTITY LEADS. No logo column in the schema yet — see header —
          so a monogram carries the brand mark instead of a photo. */}
      <div className="bg-pink-gradient shadow-glow mb-5 flex h-16 w-16 items-center justify-center rounded-3xl text-2xl font-bold text-white">
        {gift.organizationName.trim().charAt(0).toUpperCase() || "M"}
      </div>
      <p className="text-muted-foreground type-eyebrow">Credits at</p>
      <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
        {gift.organizationName}
      </h1>

      {/* THEN THE AMOUNT. */}
      <div className="mt-6 text-5xl font-bold tracking-tight tabular-nums">
        {formatCurrency(gift.creditedCents)}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {formatCurrency(gift.paidCents)} paid, +{formatCurrency(gift.bonusCents)}{" "}
        from {gift.organizationName} · spendable at {gift.organizationName}{" "}
        only
      </p>

      {gift.pending ? (
        <p className="border-border bg-muted/50 text-muted-foreground mt-5 max-w-xs rounded-2xl border px-4 py-3 text-xs leading-relaxed">
          This balance isn&apos;t spendable quite yet — it will be by the time you
          finish claiming it.
        </p>
      ) : null}

      {gift.note ? (
        <div className="border-border bg-card mt-5 w-full max-w-xs rounded-2xl border p-4 text-left">
          <p className="type-eyebrow text-muted-foreground mb-1">
            A note for you
          </p>
          <p className="text-sm">{gift.note}</p>
        </div>
      ) : null}

      <Link
        href={claimHref}
        className="bg-pink-gradient shadow-glow mt-8 flex min-h-12 w-full max-w-xs items-center justify-center rounded-2xl px-6 text-sm font-bold text-white transition active:scale-[0.98]"
      >
        Sign in to claim
      </Link>
      <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
        <MesitaMark className="h-3.5 w-3.5" />
        Runs in Stripe TEST mode — this balance is real, on that
        organization&apos;s account.
      </p>
    </Shell>
  );
}
