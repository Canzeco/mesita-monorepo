import type { Metadata } from "next";
import {
  DRAFT_DATE,
  LEGAL_PRIVACY_EMAIL,
  LegalPage,
  LegalSection,
} from "@/components/landing/legal";

// /privacy — server component, no client state (MESITA-1888).
//
// Each paragraph maps to something the code does: the profile fields the
// consumer profile actually carries, the browser/OS location prompt discovery
// asks for, Stripe's hosted card page, the columns a ticket row stores, the
// four account visibility flags, and the in-app delete. The one thing this
// page deliberately does NOT state is how long anything is kept — no retention
// period has been decided, and a drafted number would be a promise nobody can
// keep. Do not add one here; decide it, then write it.

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "Plain-language draft of what Mesita collects and why — phone sign-in, profile details, device location, what a visit records, how cards are handled by Stripe, and how to get your data or delete your account.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      lede={`What Mesita collects, why it needs it, and what you can do about it. Drafted ${DRAFT_DATE}.`}
    >
      <LegalSection heading="Your phone number">
        <p>
          Signing in is your phone number and a one-time code we text you. The
          number is how we recognise you on the next visit, so we store it. It
          is also how the code gets to you: it is sent as an SMS through the
          messaging provider that delivers our sign-in codes.
        </p>
      </LegalSection>

      <LegalSection heading="What you tell us about yourself">
        <p>
          When you set up your account we ask for your first name, your date of
          birth and your sex. Your last name is asked later, the first time you
          book a table. The date of birth is what we check against the minimum
          age of 14.
        </p>
        <p>
          A profile photo and an Instagram handle are optional. The handle is
          there because connecting it unlocks rewards in the app; if you never
          connect one, nothing else changes.
        </p>
      </LegalSection>

      <LegalSection heading="Where you are">
        <p>
          Finding places near you needs your location, so the app asks your
          browser or your phone for it. Your device decides: if you say no, or
          never answer, the app keeps working and simply cannot sort by
          distance. You can take the permission back at any time in your browser
          or phone settings.
        </p>
        <p>
          We use the position to answer the request you just made — what is
          around you, what is close to a search. We do not follow you in the
          background.
        </p>
      </LegalSection>

      <LegalSection heading="Your card">
        <p>
          Card numbers are typed on Stripe&apos;s own hosted page and are held
          by Stripe. Mesita never receives or stores a card number; what the app
          shows you is the brand and the last digits, which is what Stripe hands
          back.
        </p>
        <p>
          The first time you pay a particular place through Mesita, that payment
          creates a customer record for you inside that place&apos;s own Stripe
          account — the same thing that would happen if you checked out on their
          website. The app tells you before that first charge.
        </p>
      </LegalSection>

      <LegalSection heading="What a visit records">
        <p>
          When a place opens a ticket for you, that record holds which place it
          was, the member of their staff who opened it, when it was opened and
          when it was paid, the check subtotal, tip and total, the currency, the
          reward percentage applied and the amount that earned you.
        </p>
        <p>
          It is the receipt of the visit: it is what makes your rewards add up,
          what the place sees on its own side, and what you see in your history.
        </p>
      </LegalSection>

      <LegalSection heading="What other people see">
        <p>
          Your account has two visibility switches, in Settings under Privacy.
          You can make the account private, and you can turn off whether other
          guests see your Mesita stories. Both are yours to change whenever you
          want.
        </p>
      </LegalSection>

      <LegalSection heading="Who else is involved">
        <p>
          Mesita does not sell your information. A handful of companies are part
          of making the app work, and what reaches each of them is limited to
          what it does: our hosting and database provider runs the accounts and
          the app&apos;s data, a messaging provider delivers your sign-in code,
          Stripe handles cards and payments, and public places data is what the
          catalog of restaurants, cafés and bars is built from.
        </p>
        <p>
          A place you actually transact with sees what that transaction needs —
          your name, the ticket, and the customer record their own Stripe
          account holds.
        </p>
      </LegalSection>

      <LegalSection heading="Getting your data, and getting out">
        <p>
          You can edit or clear most of your profile from inside the app. To ask
          for a copy of your data, write to{" "}
          <a
            href={`mailto:${LEGAL_PRIVACY_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {LEGAL_PRIVACY_EMAIL}
          </a>
          .
        </p>
        <p>
          Deleting the account is in the app, in Settings, with your data. You
          type DELETE to confirm and the account is deleted; the same address
          above is the way to do it if you can no longer sign in.
        </p>
      </LegalSection>

      <LegalSection heading="What this draft does not say">
        <p>
          It does not say how long anything is kept. We have not settled that
          yet, and a number written here before it is decided would be a promise
          we could not stand behind. It is one of the things legal review is
          for, and it will be written down here when it exists.
        </p>
      </LegalSection>

      <LegalSection heading="Questions">
        <p>
          Anything on this page:{" "}
          <a
            href={`mailto:${LEGAL_PRIVACY_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {LEGAL_PRIVACY_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
