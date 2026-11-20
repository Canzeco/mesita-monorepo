"use client";

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { Globe, MessageCircle, Phone } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { PlaceSubpage } from "@/components/consumer/place-detail/PlaceSubpage";
import {
  RowDivider,
  SettingsGroup,
  SettingsLinkRow,
  type RowTint,
} from "@/components/consumer/me/settings-rows";
import type { PlaceDetail } from "@/lib/place-detail";

// Contact, a page at /place/<id>/contact (MESITA-4111). It was a sheet over
// the profile. Lists only the mediums this place actually exposes and reuses
// the Me-page row chrome so every contact list in the app reads the same.
//
// decision: Pato (MESITA-383) — exactly four channels: WhatsApp · Call ·
//   Instagram · Website (Email removed). tel: opens in place; the rest are
//   external.

type ContactRow = {
  key: string;
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub: string;
  href: string;
  external?: boolean;
};

// Pretty hostname for the website sub-line (drops protocol + www.).
function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Visit website";
  }
}

function buildContactRows(place: PlaceDetail): ContactRow[] {
  const rows: ContactRow[] = [];
  const { whatsapp_url, instagram_url, website_url } = place.channels;

  if (whatsapp_url) {
    rows.push({
      key: "whatsapp",
      Icon: MessageCircle,
      tint: "muted",
      label: "WhatsApp",
      sub: "Chat on WhatsApp",
      href: whatsapp_url,
      external: true,
    });
  }
  if (place.phone) {
    rows.push({
      key: "phone",
      Icon: Phone,
      tint: "muted",
      label: "Call",
      sub: place.phone,
      href: `tel:${place.phone.replace(/\s+/g, "")}`,
    });
  }
  if (instagram_url) {
    rows.push({
      key: "instagram",
      Icon: Instagram,
      tint: "instagram",
      label: "Instagram",
      sub: "Send a direct message",
      href: instagram_url,
      external: true,
    });
  }
  if (website_url) {
    rows.push({
      key: "website",
      Icon: Globe,
      tint: "muted",
      label: "Website",
      sub: prettyHost(website_url),
      href: website_url,
      external: true,
    });
  }
  return rows;
}

export function PlaceContactPage({ place }: { place: PlaceDetail }) {
  const rows = buildContactRows(place);
  return (
    <PlaceSubpage title="Contact" placeName={place.name} placeId={place.id}>
      <div className="px-4 py-2">
        {rows.length > 0 ? (
          <SettingsGroup flat>
            {rows.map((row, i) => (
              <Fragment key={row.key}>
                {i > 0 && <RowDivider />}
                <SettingsLinkRow
                  Icon={row.Icon}
                  tint={row.tint}
                  href={row.href}
                  label={row.label}
                  sub={row.sub}
                  external={row.external}
                />
              </Fragment>
            ))}
          </SettingsGroup>
        ) : (
          <p className="border-border bg-card text-muted-foreground type-body rounded-2xl border px-4 py-6 text-center">
            No contact details yet.
          </p>
        )}
      </div>
    </PlaceSubpage>
  );
}
