import { redirect } from "next/navigation";

// v9.1 (MESITA-621): the knobs page is the Subscores tab — the tabs mirror
// the model's layers. Old links land there.
export default function ScoringParamsRedirect() {
  redirect("/lineup-config/config");
}
