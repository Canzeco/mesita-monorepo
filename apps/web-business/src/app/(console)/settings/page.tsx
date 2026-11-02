import { redirect } from "next/navigation";

// Settings is the place's (Pato, 2026-11-02, MESITA-3114): the account is the
// rail's footer (email + sign out), so the old account page goes to the list.
export default function SettingsPage() {
  redirect("/places");
}
