import { ProfileClient } from "./ProfileClient";

// Thin server entry for /profile. The shell layout already runs the
// auth + onboarding gate and exposes the display name to TopBar, so
// this page no longer pre-fetches consumer identity — the inline
// avatar / name / subtitle block was removed (TopBar already shows
// the name in the center column + the class chip on the right) and
// nothing else on the surface needs the identity payload yet.

export const dynamic = "force-dynamic";

export default function ConsumerProfilePage() {
  return <ProfileClient />;
}
