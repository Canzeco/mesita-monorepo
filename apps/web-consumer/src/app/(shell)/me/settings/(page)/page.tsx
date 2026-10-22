import { SettingsModal } from "@/components/consumer/me/SettingsModal";

// /me/settings — device prefs, Contact, and the account controls.
//
// IN A ROUTE GROUP SO ITS FALLBACK IS ITS OWN (MESITA-2701): a loading.tsx
// beside settings/contact/ would wrap /me/settings/contact too. (page)/
// loading.tsx wraps this page only, as me/(hub) does for /me.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsModal />;
}
