import type { Metadata } from "next";
import {
  DRAFT_DATE,
  LEGAL_SUPPORT_EMAIL,
  LegalPage,
  LegalSection,
} from "@/components/landing/legal";

// /terms — server component, no client state (MESITA-1888).
//
// Every statement below describes behaviour that exists in this repo today:
// phone + one-time-code sign-in, the age floor of 14, the reservation agent
// booking on your behalf, prepayments and credits on the place's own Stripe
// account (MESITA-4918), suspension (MESITA-4899) and account deletion from
// Settings. Nothing here promises a
// timeframe, names a regulator, or grants a right the code does not already
// implement — see the draft banner.

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Plain-language draft of the terms for using Mesita — who can sign up, what an account is, how places and bookings work, and how to close your account.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of use"
      lede={`How Mesita works and what we ask of you. Drafted ${DRAFT_DATE}.`}
    >
      <LegalSection heading="What Mesita is">
        <p>
          Mesita is an app for going out. It lists restaurants, cafés and bars,
          helps you find one, and books a table for you: Mesita&apos;s
          reservation agent phones the place on your behalf and tells you how it
          went. At places that turn it on, you can also pay ahead, pay your bill
          with credit, and get credit back.
        </p>
        <p>
          Mesita is in development. Some parts of the app are live, some are
          being built, and what you can do today may change from one release to
          the next.
        </p>
      </LegalSection>

      <LegalSection heading="Who can sign up">
        <p>
          You must be 14 or older to have a Mesita account. We ask for your year
          of birth when you sign up and check it, and the server checks it
          again, so an account for someone under 14 will not be created.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          You sign in with your phone number. We text you a one-time code and
          you type it back — there is no password. That means whoever can read
          the codes sent to your number can get into your account, so keep your
          phone and your number under your control and tell us if either changes
          hands.
        </p>
        <p>
          An account is yours personally. Use your own phone number and give us
          information that is actually true — your bookings are made in your
          name.
        </p>
      </LegalSection>

      <LegalSection heading="The places you see">
        <p>
          Mesita builds its list of places from public information, and adds
          detail on top of it. A place appearing in Mesita does not mean it has
          signed up with us or agreed to anything.
        </p>
        <p>
          The place itself decides what it serves, what it charges, whether it
          honours a booking and how it treats you when you walk in. Mesita is
          how you found it and how you booked it; it is not the one seating you.
        </p>
      </LegalSection>

      <LegalSection heading="Paying ahead and credits">
        <p>
          When you pay a place ahead, the charge is made on that place&apos;s
          own Stripe account, so the place is the one that sells to you. You get
          what you paid as credit, plus the bonus shown before you pay; both
          arrive 3 hours later. Card payments are being tested while Mesita is
          in development, and the app marks a place in test mode.
        </p>
        <p>
          Credit is the place&apos;s debt to you. It spends only at that place,
          does not expire, is not money you can withdraw, and can be sent to
          someone else as a gift. A refund you get appears in the app, in
          Settings. If you think you are owed one, write to us or to the place.
        </p>
        <p>
          At the table, you show a QR code, the waiter sends the bill, and it
          closes when both of you confirm it. Read the amount before you
          confirm. Credit back arrives about an hour after it closes, on the
          part you did not pay with credit, up to the limit the app shows.
        </p>
        <p>
          You can also buy a place Premier, which makes it more visible and is
          always marked as an ad. Plans renew until you stop them.
        </p>
      </LegalSection>

      <LegalSection heading="What we ask of you">
        <p>
          Do not sign in as someone else, do not book tables you do not mean to
          keep, and do not try to break, overload or take apart the service. Do
          not use Mesita to harass anyone, a place included. Do not type or
          guess a waiter&apos;s code, or confirm a bill you did not pay.
        </p>
      </LegalSection>

      <LegalSection heading="Ending it">
        <p>
          You can delete your account from the app at any time, in Settings,
          with your data. You type DELETE to confirm, and the account is
          closed. Any plan you pay for stops first. Use your credit before you
          delete: it cannot be used from a closed account. Someone who runs a
          place on Mesita has to hand it over before deleting.
        </p>
        <p>
          Three wrong waiter codes close a bill. If that happens to you five
          times at one place in 30 days, your account is suspended; your credit
          stays, and you can write to us to have it looked at.
        </p>
        <p>
          We can close an account that is being used to break these terms, or to
          harm another person, a place or the service.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and questions">
        <p>
          These terms are a draft, and they will change — first when a lawyer
          reviews them, and afterwards as the product does. The date at the top
          of the page is the date of the version you are reading.
        </p>
        <p>
          Questions go to{" "}
          <a
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {LEGAL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
