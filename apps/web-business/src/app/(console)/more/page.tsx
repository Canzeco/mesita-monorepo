import { redirect } from "next/navigation";

// The phone's More page left with the menu (MESITA-3117).
export default function Page() {
  redirect("/places");
}
