import { SettingsModal } from "@/components/consumer/me/SettingsModal";

// /me/settings — device prefs, Contact, and the account controls.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsModal />;
}
