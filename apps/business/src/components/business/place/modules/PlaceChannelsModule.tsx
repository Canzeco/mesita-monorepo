"use client";

import { useState } from "react";
import { PlaceUrlField } from "../PlaceFormField";
import { PlaceModule } from "../PlaceModule";
import type { PlaceFormState, SetPlaceForm } from "../place-form-types";

type SecondaryChannelKey =
  | "facebook_url"
  | "tiktok_url"
  | "opentable_url"
  | "rappi_url"
  | "uber_eats_url"
  | "didi_food_url";

export function PlaceChannelsModule({
  form,
  set,
  hideHeader = false,
}: {
  form: PlaceFormState;
  set: SetPlaceForm;
  hideHeader?: boolean;
}) {
  const [secondaryNotAvailable, setSecondaryNotAvailable] = useState<
    Record<SecondaryChannelKey, boolean>
  >({
    facebook_url: false,
    tiktok_url: false,
    opentable_url: false,
    rappi_url: false,
    uber_eats_url: false,
    didi_food_url: false,
  });

  const hasOptionalValues =
    form.facebook_url.trim() !== "" ||
    form.tiktok_url.trim() !== "" ||
    form.opentable_url.trim() !== "" ||
    form.rappi_url.trim() !== "" ||
    form.uber_eats_url.trim() !== "" ||
    form.didi_food_url.trim() !== "";

  const [showOptional, setShowOptional] = useState(hasOptionalValues);

  const setSecondaryMissing = (key: SecondaryChannelKey, missing: boolean) =>
    setSecondaryNotAvailable((prev) => ({ ...prev, [key]: missing }));

  const optionalFields: {
    key: SecondaryChannelKey;
    label: string;
    placeholder: string;
  }[] = [
    {
      key: "facebook_url",
      label: "Facebook",
      placeholder: "https://facebook.com/yourplace",
    },
    {
      key: "tiktok_url",
      label: "TikTok",
      placeholder: "https://tiktok.com/@yourplace",
    },
    {
      key: "opentable_url",
      label: "OpenTable",
      placeholder: "https://www.opentable.com/...",
    },
    {
      key: "rappi_url",
      label: "Rappi",
      placeholder: "https://www.rappi.com/restaurants/...",
    },
    {
      key: "uber_eats_url",
      label: "Uber Eats",
      placeholder: "https://www.ubereats.com/store/...",
    },
    {
      key: "didi_food_url",
      label: "DiDi Food",
      placeholder: "https://www.didiglobal.com/...",
    },
  ];

  return (
    <PlaceModule id="channels" hideHeader={hideHeader}>
      <PlaceUrlField
        label="Website"
        placeholder="https://yourplace.com"
        value={form.website_url}
        onChange={(val) => set("website_url", val)}
      />
      <PlaceUrlField
        label="Phone"
        placeholder="+52 444 833 5050"
        value={form.phone}
        onChange={(val) => set("phone", val)}
      />
      <PlaceUrlField
        label="WhatsApp"
        placeholder="https://wa.me/52…"
        value={form.whatsapp_url}
        onChange={(val) => set("whatsapp_url", val)}
      />
      <PlaceUrlField
        label="Instagram"
        placeholder="https://instagram.com/yourplace"
        value={form.instagram_url}
        onChange={(val) => set("instagram_url", val)}
      />
      <PlaceUrlField
        label="Google Maps"
        placeholder="https://maps.google.com/..."
        value={form.google_maps_url}
        onChange={(val) => set("google_maps_url", val)}
      />
      <PlaceUrlField
        label="Email"
        placeholder="hola@yourplace.com"
        value={form.email}
        onChange={(val) => set("email", val)}
      />

      <button
        type="button"
        onClick={() => setShowOptional((open) => !open)}
        className="text-muted-foreground hover:text-foreground -mt-1 flex items-center gap-1 text-left text-[11px] font-medium transition"
      >
        {showOptional ? "Hide optional" : "More channels"}
      </button>

      {showOptional ? (
        <>
          {optionalFields.map(({ key, label, placeholder }) => (
            <PlaceUrlField
              key={key}
              label={label}
              placeholder={placeholder}
              value={form[key]}
              onChange={(val) => {
                set(key, val);
                if (val.trim()) setSecondaryMissing(key, false);
              }}
              missing={secondaryNotAvailable[key]}
              onToggleMissing={(missing) => setSecondaryMissing(key, missing)}
            />
          ))}
        </>
      ) : null}
    </PlaceModule>
  );
}
