import { InvitationsClient } from "./InvitationsClient";

// No server seed: `admin-web-grant-class` resolves a guest only as part of
// writing the door, and there is no roster EF to list the invitations already
// open. The page is an action surface, so it starts empty and fills in with
// whatever the last call landed on.
export default function InvitationsPage() {
  return <InvitationsClient />;
}
