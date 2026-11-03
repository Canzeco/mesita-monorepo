import { redirect } from "next/navigation";

// Products became each place's Future page (MESITA-3128); a place lives under Places.
export default function Page() {
  redirect("/places");
}
