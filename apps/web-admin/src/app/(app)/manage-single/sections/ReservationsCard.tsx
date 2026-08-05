"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck, Phone } from "lucide-react";
import {
  updatePlace,
  type AdminPlace,
  type ReservationChannel,
  type ReservationTarget,
} from "../actions";
import { SaveBar, SectionCard } from "../ui";

// Reservations — which Place → Channels contact the Reservationist uses.
// Moved onto Settings (MESITA-837). Voice-only today (MESITA-842): phone is
// the only selectable serving channel. WhatsApp + Instagram are shown so the
// operator sees the roadmap and that each channel binds a *different* contact
// (`phone` / `whatsapp_url` / `instagram_url`) — both parked with Soon until
// a Messages path ships (MESITA-839).

const str = (v: unknown) => (typeof v === "string" ? v : "");

const isReservationChannel = (c: unknown): c is ReservationChannel =>
  c === "phone";

/** Digits from a wa.me URL (or plain E.164) for display. */
function displayWhatsApp(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const m = t.match(/wa\.me\/(\+?\d+)/i);
  if (m?.[1]) {
    const digits = m[1].replace(/\D/g, "");
    return digits ? `+${digits}` : t;
  }
  return t;
}

/** @handle or short path from an Instagram URL. */
function displayInstagram(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    if (seg) return seg.startsWith("@") ? seg : `@${seg}`;
  } catch {
    /* fall through */
  }
  return t;
}

function readReservationChannel(v: AdminPlace): ReservationChannel | "" {
  const raw = v.products?.reservations as unknown;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (isReservationChannel(obj.channel)) return obj.channel;
  }
  return "";
}

type ChannelOption =
  | {
      id: "phone";
      label: "Phone";
      selectable: true;
      contact: string;
      contactKind: "Phone";
    }
  | {
      id: "whatsapp" | "instagram";
      label: "WhatsApp" | "Instagram";
      selectable: false;
      contact: string;
      contactKind: "WhatsApp" | "Instagram";
      logo: string;
    };

export function ReservationsCard({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const saved = useMemo(() => readReservationChannel(place), [place]);
  const phoneValue = str(place.phone);
  const whatsappValue = displayWhatsApp(str(place.whatsapp_url));
  const instagramValue = displayInstagram(str(place.instagram_url));
  const hasPhone = phoneValue.trim() !== "";

  const options = useMemo<ChannelOption[]>(
    () => [
      {
        id: "phone",
        label: "Phone",
        selectable: true,
        contact: phoneValue.trim(),
        contactKind: "Phone",
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        selectable: false,
        contact: whatsappValue,
        contactKind: "WhatsApp",
        logo: "/channels/whatsapp.svg",
      },
      {
        id: "instagram",
        label: "Instagram",
        selectable: false,
        contact: instagramValue,
        contactKind: "Instagram",
        logo: "/channels/instagram.svg",
      },
    ],
    [phoneValue, whatsappValue, instagramValue],
  );

  const [channel, setChannel] = useState<ReservationChannel | "">(
    saved || (hasPhone ? "phone" : ""),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = channel !== saved;
  const active = channel === "phone";

  const save = () => {
    if (!channel) {
      setError("Set a phone under Place → Channels — the agent books by voice only.");
      setOk(false);
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const target: ReservationTarget = {
        channel: "phone",
        value: phoneValue.trim() || null,
      };
      const r = await updatePlace({
        id: place.id,
        reservation_endpoint: null,
        reservation_contacts: [],
        products: { ...(place.products ?? {}), reservations: target },
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSaved(r.data);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  return (
    <SectionCard
      icon={<CalendarCheck className="h-4 w-4" />}
      tint="teal"
      title="Reservations"
      subtitle="Mesita's AI agent books by phone — the Reservationist is voice-only today."
    >
      <p className="text-muted-foreground mt-5 text-xs">
        Each channel uses its own contact from Place → Channels (Phone,
        WhatsApp, Instagram). Only Phone is live; WhatsApp and Instagram are
        coming soon.
      </p>
      <div className="mt-3.5 grid gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
            Channel
          </span>
          <div
            role="group"
            aria-label="Reservation channel"
            className="grid grid-cols-3 gap-2"
          >
            {options.map((opt) => {
              if (opt.selectable) {
                const pressed = active;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => hasPhone && setChannel("phone")}
                    disabled={pending || !hasPhone}
                    aria-pressed={pressed}
                    title={
                      !hasPhone
                        ? "Add a Phone contact under Place → Channels to use it"
                        : undefined
                    }
                    className={
                      "relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 " +
                      (pressed
                        ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                        : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
                    }
                  >
                    <Phone
                      className={
                        "h-6 w-6 shrink-0 " +
                        (pressed ? "text-primary" : "text-muted-foreground")
                      }
                    />
                    Phone
                    {!hasPhone ? (
                      <span className="text-muted-foreground/70 text-[9px] font-medium">
                        not set
                      </span>
                    ) : null}
                  </button>
                );
              }

              return (
                <div
                  key={opt.id}
                  aria-disabled
                  title={`${opt.label} booking — coming soon`}
                  className="border-border/60 bg-muted/25 relative flex min-h-[5.25rem] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-1.5 py-2 text-[12px] font-semibold opacity-60"
                >
                  <span className="bg-muted text-muted-foreground absolute top-1.5 right-1.5 rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
                    Soon
                  </span>
                  {/* Static brand SVG — same pattern as Place → Channels. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={opt.logo}
                    alt=""
                    aria-hidden
                    className="h-6 w-6 shrink-0 opacity-80"
                  />
                  <span className="text-foreground/70">{opt.label}</span>
                  {!opt.contact ? (
                    <span className="text-muted-foreground/70 text-[9px] font-medium">
                      not set
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <ul className="mt-1 grid gap-1">
            {options.map((opt) => (
              <li key={opt.id} className="text-muted-foreground text-xs">
                <span className="text-foreground/80 font-medium">
                  {opt.contactKind}:
                </span>{" "}
                {opt.contact ? (
                  <span className="text-foreground/90 font-medium break-all">
                    {opt.contact}
                  </span>
                ) : (
                  <span className="text-amber-700/90 font-medium">
                    not set — add under Place → Channels
                  </span>
                )}
                {!opt.selectable ? (
                  <span className="text-muted-foreground/70"> · Soon</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SaveBar
        pending={pending}
        dirtyLabel="Reservations · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={() => setChannel(saved || (hasPhone ? "phone" : ""))}
      />
    </SectionCard>
  );
}
