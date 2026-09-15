// Capabilities — THE PLACE's switches: what a guest can do here.
//
// MEMBERS USED TO BE ON THIS PAGE (MESITA-1832: "the place's switches · the
// organization's Members"). It moved in MESITA-1839. One page about two
// different nouns is a page that cannot be addressed: whose settings is
// `/settings`? The place's switches belong to the place and travel with it;
// who may sign in belongs to the organization and outlives every place it
// holds.
//
// A URL IS NOT A CAPABILITY, and the rail offers this row to owners and
// editors only — a viewer who types the address is refused. That refusal
// moved to `PlaceTabGate` in the layout (MESITA-1875): the matrix is the same
// `tabsForAccess`, read from what the layout already resolved instead of two
// Edge Function calls per navigation.
import { CapabilitiesTab } from "./CapabilitiesTab";

export default function CapabilitiesPage() {
  return <CapabilitiesTab />;
}
