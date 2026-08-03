import { redirect } from "next/navigation";

/** Renamed to Bulk Enrich (Pato 2026-08-03) — keep the old URL working. */
export default function ManageMultipleUpdateRedirectPage() {
  redirect("/manage-multiple/enrich");
}
