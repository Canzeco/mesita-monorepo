import type { Metadata } from "next";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Card, Chip, Section, Stat, StatGrid } from "@/components/ui";
import { place, profileChecklist } from "@/lib/mock";

import { profileTabs } from "./tabs";

export const metadata: Metadata = { title: "Profile" };

const fixHref: Record<string, string> = {
  "At least 8 photos": "/profile/photos",
  "Cover photo": "/profile/photos",
  "Instagram account": "/profile/links",
  "Google review link": "/profile/links",
  Website: "/profile/links",
  "Menu link": "/profile/links",
};

export default function ProfileActivity() {
  const done = profileChecklist.filter((c) => c.done).length;
  return (
    <PageBody>
      <PageHeader
        title="Profile"
        sub={`${place.name} · ${place.neighborhood}`}
        status={place.verified ? <Chip tone="success">Claimed · Verified</Chip> : <Chip tone="warning">Unclaimed</Chip>}
        tabs={profileTabs}
      />
      <StatGrid>
        <Stat label="Profile views" value="2,140" hint="Last 30 days" />
        <Stat label="Saves" value="186" />
        <Stat label="Taps on Map" value="412" />
        <Stat label="Taps on Instagram" value="97" />
      </StatGrid>
      <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        You are on Free. <Link href="/premier" className="font-medium text-foreground underline">Premier</Link> shows your place more often in discovery.
      </p>

      <Section title={`Complete your profile · ${done} of ${profileChecklist.length}`}>
        <Card className="divide-y divide-border">
          {profileChecklist.map((c) => (
            <div key={c.label} className="flex items-center gap-3 px-4 py-3">
              {c.done ? (
                <span className="grid size-5 place-items-center rounded-full bg-success text-white">
                  <Check className="size-3.5" aria-hidden />
                </span>
              ) : (
                <Circle className="size-5 text-border" aria-hidden />
              )}
              <span className={c.done ? "flex-1 text-muted-foreground" : "flex-1 font-medium"}>{c.label}</span>
              {!c.done && fixHref[c.label] ? (
                <Link href={fixHref[c.label]} className="text-sm font-medium text-brand-text">
                  Add
                </Link>
              ) : null}
            </div>
          ))}
        </Card>
      </Section>
    </PageBody>
  );
}
