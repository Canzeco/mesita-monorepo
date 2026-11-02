import { redirect } from "next/navigation";

// Products live at the foot of Settings (MESITA-3117).
export default function Page() {
  redirect("/settings");
}
