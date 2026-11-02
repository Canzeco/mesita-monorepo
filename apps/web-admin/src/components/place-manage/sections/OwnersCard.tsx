"use client";

// Who runs this place (MESITA-3103): the guests whose place_managers row is
// live, and the "I run this place" requests waiting. Read-only here; Mesita
// staff approve, reject and revoke in the Business app's Internal page.

import { Users } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import { businessPlaceHref } from "@/lib/business-url";
import type { AdminPlace } from "../actions";

type Owner = {
  id: string;
  name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
  method: string;
  expires_at: string;
  live: boolean;
};

type Pending = { id: string; name: string; role: string; created_at: string; phone: string | null };

const METHOD: Record<string, string> = { phone_match: "Phone on listing", phone_code: "Code to listing phone", review: "Reviewed" };

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function OwnersCard({ place }: { place: AdminPlace }) {
  const owners = (Array.isArray(place.owners) ? place.owners : []) as Owner[];
  const pending = (Array.isArray(place.pending_requests) ? place.pending_requests : []) as Pending[];
  const review = businessPlaceHref(place.id, "internal");
  return (
    <SectionCard icon={<Users className="h-4 w-4" />} title="Owners" subtitle="Who runs this place in the Business app">
      <div className="flex flex-col gap-3 text-sm">
        {owners.length === 0 && pending.length === 0 ? (
          <p className="text-muted-foreground">Nobody runs this place on Mesita yet.</p>
        ) : null}
        {owners.map((o) => (
          <div key={o.id} className="flex flex-col">
            <span className="font-medium">
              {[o.name, o.phone, o.instagram_handle ? `@${o.instagram_handle}` : null].filter(Boolean).join(" · ") || "Guest"}
            </span>
            <span className="text-muted-foreground">
              {METHOD[o.method] ?? o.method} · {o.live ? `until ${day(o.expires_at)}` : `expired ${day(o.expires_at)}`}
            </span>
          </div>
        ))}
        {pending.map((r) => (
          <div key={r.id} className="flex flex-col">
            <span className="font-medium">{r.name}, {r.role}</span>
            <span className="text-muted-foreground">Asked {day(r.created_at)} · waiting for review</span>
          </div>
        ))}
        {review ? (
          <a href={review} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
            Review in Business
          </a>
        ) : null}
      </div>
    </SectionCard>
  );
}
