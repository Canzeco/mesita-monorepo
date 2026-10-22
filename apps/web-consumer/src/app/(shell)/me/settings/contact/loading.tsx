import { Mail } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { SettingsRowSkeleton } from "../../me-skeletons";

// /me/settings/contact's fallback: ContactModal's frame (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"). The 48px mail disc and its line are fixed, so they are drawn as
// themselves; the three lines out (Email us, Get help, Instagram) are doors,
// so each is a 60px row silhouette in the same white card, 20px under.
export default function ContactLoading() {
  return (
    <MeScreen title="Contact us">
      <div className="flex items-center gap-3">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Mail className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          We usually reply within a day
        </p>
      </div>

      <div className="mt-5">
        <SettingsGroup>
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
        </SettingsGroup>
      </div>
      <p role="status" className="sr-only">
        Loading contact
      </p>
    </MeScreen>
  );
}
