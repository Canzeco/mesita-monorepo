import { redirect } from "next/navigation";

export default function LegacyAdeaCalculatorRedirect() {
  redirect("/enricher-config/playground");
}
