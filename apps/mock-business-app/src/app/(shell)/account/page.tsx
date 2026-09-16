// `/account` IS AN OLD ADDRESS, NOT A PAGE (MESITA-1935).
//
// The person's page is `/settings` now, because Account and Settings were two
// rail rows that both meant configuration and a reader had to learn which held
// what. This file stays behind so the address that shipped does not 404: it
// carries no UI, reads no store, and exists only to point at its replacement.
//
// It is the one server component in this app, deliberately — a redirect that
// needs no JavaScript is a redirect that happens before a frame is painted,
// and there is nothing here to hydrate. Delete it only when nobody can still
// be holding the old link.
import { redirect } from "next/navigation";
import { SHELL_ROUTES } from "@/lib/console-routes";

export default function AccountPage() {
  redirect(SHELL_ROUTES.settings);
}
