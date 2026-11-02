import { redirect } from "next/navigation";

// Settings is a place's (Pato, 2026-11-02, MESITA-3120: "in settings is the
// place settings"): without a place there is nothing to set, so pick one.
export default function SettingsPage() {
  redirect("/places");
}
