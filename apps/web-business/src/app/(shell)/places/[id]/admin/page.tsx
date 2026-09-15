// Admin — operator internals, super-admin only.
//
// The tab row never offers this to a restaurant, and the gate refuses it
// outright: a typed URL is not a capability. `tabsForAccess` puts `admin` in
// the set only when `isSuperAdmin`, so `PlaceTabGate` in the layout is the
// same refusal from the same matrix (MESITA-1875) — this page used to spend
// `business-web-get-overview` re-reading `manage.isSuperAdmin`, which the
// layout had already folded into the tab set it hands the rail.
import { AdminTab } from "./AdminTab";

export default function PlaceAdminPage() {
  return <AdminTab />;
}
