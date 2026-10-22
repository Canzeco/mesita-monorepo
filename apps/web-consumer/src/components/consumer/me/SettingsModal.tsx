"use client";

import type { ReactNode } from "react";
import { FileText, MessageSquare, ScrollText } from "lucide-react";
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
// buttons from settings"). The one server write left here is Sign out.
// Social has one switch, "Public profile" (MESITA-2590, MESITA-2594): off, you
// still show, by first name, without photo or handle (MESITA-2612). Nothing makes a member disappear from Social
// (MESITA-2552: "if you connect your … instagram, is because you want to be
// seen").
//
// THE FRAME IS SettingsFrame, AND THE FALLBACK WEARS IT (MESITA-2701). The
// title, the four groups under their eyebrows, their order, the 24px between
// them and the version line exist once; /me/settings' loading.tsx fills the
// same frame with row silhouettes (Pato, MESITA-2701: "the placeholders must
// be similar to the page you are loading, like the sizes").

/** Sign out's row: a 16px glyph and one 14px line, 44px. */
const SIGN_OUT_ROW_CLASS =
  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold";

/** Settings' page, its rows passed in: the page's own, or the fallback's
 *  silhouettes. `children` lands after the version line (the fallback's
 *  status line). */
export function SettingsFrame({
  account,
  social,
  session,
  support,
  children,
}: {
  account: ReactNode;
  social: ReactNode;
  session: ReactNode;
  support: ReactNode;
  children?: ReactNode;
}) {
  return (
    <MeScreen title="Settings">
      <div className="flex flex-col gap-6">
        {/* Contact is the only door to a human. Support, below, is legal. */}
        <SettingsGroup title="Your account">{account}</SettingsGroup>

        <SettingsGroup title="Social">{social}</SettingsGroup>

        {/* Sign out is an account control, so it sits with the rest of
            them. Support follows: legal moved off its own tile
            (MESITA-2169) and /me/help 308s here. Nothing below Support
            but the version, which stays one line. */}
        <SettingsGroup title="Session">{session}</SettingsGroup>

        <SettingsGroup title="Support">{support}</SettingsGroup>

        <p className="text-muted-foreground type-body text-center">
          Mesita · {APP_VERSION}
        </p>
      </div>
      {children}
    </MeScreen>
  );
}

/** Sign out while the page loads: its row, the glyph's box and a bar on the
 *  label's line (MESITA-2701). */
export function SignOutRowSkeleton() {
  return (
    <div aria-hidden className={SIGN_OUT_ROW_CLASS}>
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
      <SkeletonLine className="flex-1" bar="w-16" />
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
          <SettingsLinkRow
            Icon={MessageSquare}
            tint="muted"
            href={CONSUMER_ROUTES.mePages.settingsContact}
            label="Contact"
            sub="Talk to us"
          />
        </>
      }
      social={<SocialNameRow />}
      session={
        <SignOutButton
          redirectTo="/"
          className={cn(SIGN_OUT_ROW_CLASS, "hover:bg-muted transition")}
        />
      }
      support={
        <>
          <SettingsLinkRow
            Icon={ScrollText}
            tint="muted"
            href={MESITA_TERMS_URL}
            label="Terms of use"
            sub="mesita.ai/terms"
            external
          />
          <RowDivider />
          <SettingsLinkRow
            Icon={FileText}
            tint="muted"
            href={MESITA_PRIVACY_URL}
            label="Privacy policy"
            sub="mesita.ai/privacy"
            external
          />
        </>
      }
    />
  );
}
