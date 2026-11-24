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
// asks for, what the reservation agent tells a place, what a place and other
// guests see (social-level.ts, monitor.ts, visit-web-get-bill), payments
// through Stripe, and the in-app delete (delete-history-free.ts). The one thing this
// page deliberately does NOT state is how long anything is kept — no retention
// period has been decided, and a drafted number would be a promise nobody can
// keep. Do not add one here; decide it, then write it.

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "Plain-language draft of what Mesita collects and why — phone sign-in, profile details, device location, payments, what places and other guests see, and how to get your data or delete your account.",
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
          When you set up your account we ask for your first name, your year of
          birth and your sex. Your last name is asked later, the first time you
          book a table. The year of birth is what we check against the minimum
          age of 14.
        </p>
        <p>
          A profile photo and an Instagram handle are optional. Instagram is not
          part of signing up: we use it only to check whether you qualify for
          VIP, which you can also get with an invitation code. Other guests
          never see your Instagram.
        </p>
        <p>
          When you connect Instagram by sending Mesita&apos;s Instagram account a
          one-time code, Instagram tells us your username and, if you allow it,
          your follower count. We don&apos;t take your photo or your follower
          list. Mesita never messages anyone first.
        </p>
      </LegalSection>

      <LegalSection heading="What other guests see">
        <p>
          If your profile is Public, other guests can see in Social that you
          viewed, liked or shared a place, with your first name, age and sex. If
          it is Private, they see none of it and you see none of theirs. You
          choose in the app, in your profile.
        </p>
        <p>
          Anyone who is not surely 18 by their year of birth, or gave none, is
          always Private and cannot change it.
        </p>
      </LegalSection>

      <LegalSection heading="What a place sees">
        <p>
          The people who run a place see the guests who viewed, liked, shared,
          visited, paid or hold credit there: your first name, your photo, whether you
          are VIP, what you did and what you spent there. They can
          see that your Instagram is verified, never the handle. The Public and Private
          choice is about other guests, not about the place.
        </p>
        <p>
          When you pay at the table, the waiter&apos;s screen shows your first
          name, photo, age and sex, so they can check you are their guest, and
          the bill you share.
        </p>
      </LegalSection>

      <LegalSection heading="Payments">
        <p>
          Cards are handled by Stripe; Mesita never stores your card number. A
          card you save is kept by Stripe, and paying a place ahead shares it
          with that place&apos;s Stripe account to make the charge.
        </p>
        <p>
          We keep a record of what you bought, spent, earned, sent as a gift and
          were refunded at each place, because that record is your credit. If
          you send a gift, the person who takes it sees your first name and photo.
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
          background. A location you save in the app is stored with your account
          until you remove it.
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
          a voice provider carries the reservation agent&apos;s phone calls, AI
          providers answer what you ask Mesita, Stripe handles payments, and
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
          type DELETE to confirm; the same address above is the way to do it if
          you can no longer sign in.
        </p>
        <p>
          If you never booked, paid or held credit, the account is erased. If
          you did, it is closed: your name, phone number, photo, year of birth,
          sex, Instagram and saved locations are removed and nobody can sign in
          to it, but the records of those bookings and payments stay.
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
