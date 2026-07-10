"use client";

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { Globe, Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  RowDivider,
  SettingsGroup,
  SettingsLinkRow,
  type RowTint,
} from "@/components/consumer/me/settings-rows";
import type { PlaceDetail } from "@/lib/mock/place";

// Contact chooser opened from the place profile's "Contact" action. Lists only
// the mediums this place actually exposes and reuses the Me-page row chrome so
// every contact sheet in the app reads the same.
//
// decision: Pato — WhatsApp leads (the default direct line in MX), then Call,
//   Instagram DM, Email, Website. tel:/mailto: open in place; the rest are
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
      tint: "emerald",
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
      tint: "emerald",
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
  if (place.email) {
    rows.push({
      key: "email",
      Icon: Mail,
      tint: "amber",
      label: "Email",
      sub: place.email,
      href: `mailto:${place.email}`,
    });
  }
  if (website_url) {
    rows.push({
      key: "website",
      Icon: Globe,
      tint: "sky",
      label: "Website",
      sub: prettyHost(website_url),
      href: website_url,
      external: true,
    });
  }
  return rows;
}

export function PlaceContactSheet({
  place,
  open,
  onClose,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  const rows = buildContactRows(place);

  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel={`Contact ${place.name}`}
    >
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Contact
            </h2>
            <p className="text-muted-foreground truncate text-[12px]">
              {place.name}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {rows.length > 0 ? (
            <SettingsGroup>
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
            <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-6 text-center text-[13px]">
              No contact details yet.
            </p>
          )}
        </div>
      </div>
    </LocalSheet>
  );
}
