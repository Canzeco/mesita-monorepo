import { ClassFromProfile } from "./ClassFromProfile";

// /me/class — the class you are in, Regular or VIP (MESITA-2562).
// It reads the profile the shell already holds (MESITA-3014).
export const dynamic = "force-dynamic";

export default function Page() {
  return <ClassFromProfile />;
}
