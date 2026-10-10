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
// asks for, what the reservation agent tells a place, and the in-app delete.
// The MVP takes no payments and records no visits (MESITA-2092), so cards,
// Stripe and tickets are not on this page. The one thing this
// page deliberately does NOT state is how long anything is kept — no retention
// period has been decided, and a drafted number would be a promise nobody can
// keep. Do not add one here; decide it, then write it.

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "Plain-language draft of what Mesita collects and why — phone sign-in, profile details, device location, what a booking shares with the place, and how to get your data or delete your account.",
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
          number is how we recognise you the next time you sign in, so we store
          it. It is also how the code gets to you: it is sent as an SMS through
          the messaging provider that delivers our sign-in codes.
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
          A profile photo and an Instagram handle are optional. The handle shows
          on your profile; if you never connect one, nothing else changes.
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

      <LegalSection heading="What a booking shares">
        <p>
          When you ask Mesita to book a table, the reservation agent phones the
          place and gives it what a booking needs: your name, how many people,
          and the date and time.
        </p>
      </LegalSection>

      <LegalSection heading="Who else is involved">
        <p>
          Mesita does not sell your information. A handful of companies are part
          of making the app work, and what reaches each of them is limited to
          what it does: our hosting and database provider runs the accounts and
          the app&apos;s data, a messaging provider delivers your sign-in code,
          a voice provider carries the reservation agent&apos;s phone calls, and
          public places data is what the catalog of restaurants, cafés and bars
          is built from.
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
