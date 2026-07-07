import { redirect } from "next/navigation";

export default function LegacyAdeaCalculatorRedirect() {
  redirect("/atlas-config/calculator");
}
