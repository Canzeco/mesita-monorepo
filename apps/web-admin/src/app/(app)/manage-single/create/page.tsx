import { permanentRedirect } from "next/navigation";

// Legacy /manage-single/create → select (create lives in the select flow).
export default function ManageSingleSelectRedirectPage() {
  permanentRedirect("/manage-single/select");
}
