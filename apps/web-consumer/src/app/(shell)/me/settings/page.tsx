import { SettingsModal } from "@/components/consumer/me/SettingsModal";

// /me/settings — device prefs + privacy. Canonical again after MESITA-188.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsModal />;
}
