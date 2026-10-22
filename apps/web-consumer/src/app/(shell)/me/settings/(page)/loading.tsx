import { RowDivider } from "@/components/consumer/me/settings-rows";
import {
  SettingsFrame,
  SignOutRowSkeleton,
} from "@/components/consumer/me/SettingsModal";
import { PUBLIC_PROFILE_SWITCH } from "@/components/consumer/me/switch-words";
import { SettingsRowSkeleton } from "../../me-skeletons";

// /me/settings' fallback: SettingsModal's own frame — the title, the four
// groups 24px apart under their eyebrows, the version line — filled with
// row silhouettes (Pato, MESITA-2701: "the placeholders must be similar to
// the page you are loading, like the sizes"). Every row is a door or a
// fetched fact, so each is a silhouette at its height:
//
//   Your account   Phone (a fact) · Contact (a link)       60px rows
//   Social         Public profile, with its switch; its words are
//                  SocialNameRow's first paint (switch-words.ts), drawn as
//                  themselves because the line wraps to two on a narrow phone
//   Session        Sign out: a 16px glyph and one 14px line, 44px
//   Support        Terms · Privacy                         60px rows
//
// IN A ROUTE GROUP SO IT WRAPS THIS PAGE ONLY (MESITA-2701), as (hub) does
// for /me. Beside settings/contact/ it also wrapped /me/settings/contact, and
// a navigation there stops its prefetch at the first loading boundary, so
// it painted Settings' four groups before the Contact page.
export default function SettingsLoading() {
  return (
    <SettingsFrame
      account={
        <>
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
        </>
      }
      social={
        <SettingsRowSkeleton
          label={PUBLIC_PROFILE_SWITCH.label}
          sub={PUBLIC_PROFILE_SWITCH.on}
          toggle
        />
      }
      session={<SignOutRowSkeleton />}
      support={
        <>
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
        </>
      }
    >
      <p role="status" className="sr-only">
        Loading settings
      </p>
    </SettingsFrame>
  );
}
