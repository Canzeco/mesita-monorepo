"use client";

import type { ReactNode } from "react";
import { FileText, MessageSquare, MessageSquareHeart, ScrollText } from "lucide-react";
import { MESITA_PRIVACY_URL, MESITA_TERMS_URL } from "@/lib/mesita-contact";
import { APP_VERSION } from "@/lib/app-version";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  RowDivider,
  SettingsGroup,
  SettingsLinkRow,
} from "@/components/consumer/me/settings-rows";
import { PhoneRow } from "@/components/consumer/me/PhoneRow";
import { SocialNameRow } from "@/components/consumer/me/SocialNameRow";
import { Skeleton, SkeletonLine } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

// Only rows that do something. Push, Location, Language and Default location
// saved to localStorage and nothing read them; Export my data was a mailto;
// Delete account went with them (Pato, MESITA-2589: "remove stupid fake
// buttons from settings"), came back (MESITA-3049) and left again
// (MESITA-3468: "remove the stupid delete account button"); Contact is the
// way to ask, and Send feedback (MESITA-3029) the way to tell us about the
// app itself. The one server write here is Sign out.
// Social has one switch, "Public profile" (MESITA-2590, MESITA-2594): off, you
// still show, by first name, without photo or handle (MESITA-2612). Nothing makes a member disappear from Social
// (MESITA-2552: "if you connect your … instagram, is because you want to be
// seen").
//
// THREE GROUPS AND SIGN OUT (Pato, MESITA-3793: "make this better. it looks
// like shit"). Four eyebrows for six rows read as clutter: Contact and
// Feedback sat under "Your account", Social and Session were one-row groups,
// Sign out drew a different row, and Terms and Privacy showed raw URLs.
//
//   ACCOUNT   Phone (a fact) · Public profile (the switch)
//   HELP      Contact · Send feedback
//   LEGAL     Terms of use · Privacy policy (an arrow out: they leave the app)
//   ────────  Sign out, its own card, one centred row
//   Mesita · version
//
// THE FRAME IS SettingsFrame, AND THE FALLBACK WEARS IT (MESITA-2701): the
// title, the groups under their eyebrows, their order, the 24px between them
// and the version line exist once; /me/settings' loading.tsx fills the same
// frame with row silhouettes.

/** Sign out's row: centred, one 14px line with its glyph, 52px. */
const SIGN_OUT_ROW_CLASS =
  "flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold";

/** Settings' page, its rows passed in: the page's own, or the fallback's
 *  silhouettes. `children` lands after the version line (the fallback's
 *  status line). */
export function SettingsFrame({
  account,
  help,
  legal,
  signOut,
  children,
}: {
  account: ReactNode;
  help: ReactNode;
  legal: ReactNode;
  signOut: ReactNode;
  children?: ReactNode;
}) {
  return (
    <MeScreen title="Settings">
      <div className="flex flex-col gap-6">
        <SettingsGroup title="Account">{account}</SettingsGroup>
        <SettingsGroup title="Help">{help}</SettingsGroup>
        <SettingsGroup title="Legal">{legal}</SettingsGroup>
        <SettingsGroup>{signOut}</SettingsGroup>
        <p className="text-muted-foreground type-label -mt-2 text-center">
          Mesita · {APP_VERSION}
        </p>
      </div>
      {children}
    </MeScreen>
  );
}

/** Sign out while the page loads: its row and a bar on the label's line
 *  (MESITA-2701). */
export function SignOutRowSkeleton() {
  return (
    <div aria-hidden className={SIGN_OUT_ROW_CLASS}>
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
      <SkeletonLine className="w-16" bar="w-16" />
    </div>
  );
}

export function SettingsModal() {
  return (
    <SettingsFrame
      account={
        <>
          {/* The login phone left Me's card for here (MESITA-2547). */}
          <PhoneRow />
          <RowDivider />
          <SocialNameRow />
        </>
      }
      help={
        <>
          <SettingsLinkRow
            Icon={MessageSquare}
            tint="muted"
            href={CONSUMER_ROUTES.mePages.settingsContact}
            label="Contact"
            sub="Talk to a person"
          />
          <RowDivider />
          <SettingsLinkRow
            Icon={MessageSquareHeart}
            tint="muted"
            href={CONSUMER_ROUTES.mePages.settingsFeedback}
            label="Send feedback"
            sub="Tell us what to fix"
          />
        </>
      }
      legal={
        <>
          <SettingsLinkRow
            Icon={ScrollText}
            tint="muted"
            href={MESITA_TERMS_URL}
            label="Terms of use"
            external
          />
          <RowDivider />
          <SettingsLinkRow
            Icon={FileText}
            tint="muted"
            href={MESITA_PRIVACY_URL}
            label="Privacy policy"
            external
          />
        </>
      }
      signOut={
        <SignOutButton
          redirectTo="/"
          className={cn(SIGN_OUT_ROW_CLASS, "hover:bg-muted transition")}
        />
      }
    />
  );
}
