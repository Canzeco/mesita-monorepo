import { ContactFrame } from "@/components/consumer/me/ContactModal";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { SettingsRowSkeleton } from "../../me-skeletons";

// /me/settings/contact's fallback: ContactModal's own frame (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). The title and the reply-time line are
// fixed, so the frame draws them as themselves; the three lines out (Email
// us, Get help, Instagram) are doors, so each is a 60px row silhouette in
// the same white card.
export default function ContactLoading() {
  return (
    <ContactFrame
      rows={
        <>
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
          <RowDivider />
          <SettingsRowSkeleton />
        </>
      }
    >
      <p role="status" className="sr-only">
        Loading contact
      </p>
    </ContactFrame>
  );
}
