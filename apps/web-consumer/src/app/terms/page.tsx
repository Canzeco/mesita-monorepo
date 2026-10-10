import type { Metadata } from "next";
import {
  DRAFT_DATE,
  LEGAL_SUPPORT_EMAIL,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal";

// /terms — server component, no client state, outside the (shell) auth wall.
//
// Every statement below describes behaviour that exists in this repo today:
// phone + one-time-code sign-in, the age floor of 14, the catalog built from
// public information, bookings requested by Mesita's phone agent, and account
// deletion from Settings. Nothing here promises a timeframe, names a
// regulator, or grants a right the code does not already implement — see the
// draft banner.

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Plain-language draft of the terms for using Mesita — who can sign up, what an account is, how places and bookings work, and how to close your account.",
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
          helps you find one, and can ask a place for a table on your behalf.
        </p>
        <p>
          Mesita is in development. Some parts of the app are live, some are
          being built, and what you can do today may change from one release to
          the next.
        </p>
      </LegalSection>

      <LegalSection heading="Who can sign up">
        <p>
          You must be 14 or older to have a Mesita account. We ask for your date
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
          information that is actually true — bookings are made in your name.
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
          how you found it; it is not the one seating you.
        </p>
      </LegalSection>

      <LegalSection heading="Bookings">
        <p>
          When you ask for a table, Mesita phones the place for you with an
          automated voice agent and passes on what the booking needs — the name
          to expect, the party size, the date and the time. The place decides
          whether it can hold the table, and the app shows you what it answered.
        </p>
        <p>
          A booking Mesita relays is the place&apos;s booking. If plans change,
          cancel it in the app so the place can give the table to someone else.
        </p>
      </LegalSection>

      <LegalSection heading="What we ask of you">
        <p>
          Do not sign in as someone else, and do not try to break, overload or
          take apart the service. Do not use Mesita to harass anyone, book
          tables you do not mean to use, or tell a place anything you know to be
          untrue.
        </p>
      </LegalSection>

      <LegalSection heading="Ending it">
        <p>
          You can delete your account from the app at any time, in Settings.
          You type DELETE to confirm, and the account is deleted.
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
