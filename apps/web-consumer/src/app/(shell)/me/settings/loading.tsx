import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { Skeleton, SkeletonLine } from "@/components/shared/Skeleton";
import { APP_VERSION } from "@/lib/app-version";
import { SettingsRowSkeleton } from "../me-skeletons";

// /me/settings' fallback: SettingsModal's four groups, 24px apart, under
// their real eyebrows (Pato, MESITA-2701: "the placeholders must be similar
// to the page you are loading, like the sizes"). Every row is a door or a
// fetched fact, so each is a row silhouette at its height:
//
//   Your account   Phone (a fact) · Contact (a link)       60px rows
//   Social         Public profile, with its switch; its words are
//                  SocialNameRow's first paint, drawn as themselves because
//                  the line wraps to two on a narrow phone
//   Session        Sign out: a 16px glyph and one 14px line, 44px
//   Support        Terms · Privacy                         60px rows
//
// then the version line, a fixed caption outside the cards, as itself.
export default function SettingsLoading() {
  return (
    <MeScreen title="Settings">
      <div className="flex flex-col gap-6">
        <SettingsGroup title="Your account">
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
        </SettingsGroup>

        <SettingsGroup title="Social">
          <SettingsRowSkeleton
            label="Public profile"
            sub="You're visible in the Social feed"
            toggle
          />
        </SettingsGroup>

        <SettingsGroup title="Session">
          <div aria-hidden className="flex w-full items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <SkeletonLine className="flex-1 text-sm" bar="w-16" />
          </div>
        </SettingsGroup>

        <SettingsGroup title="Support">
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
        </SettingsGroup>

        <p className="text-muted-foreground type-body text-center">
          Mesita · {APP_VERSION}
        </p>
      </div>
      <p role="status" className="sr-only">
        Loading settings
      </p>
    </MeScreen>
  );
}
