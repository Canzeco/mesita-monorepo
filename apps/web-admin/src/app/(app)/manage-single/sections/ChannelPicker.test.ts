import { describe, expect, it } from "vitest";

import {
  contactForChannel,
  isServingChannel,
  readChannel,
  SERVING_CHANNELS,
  targetForChannel,
} from "./ChannelPicker";

import type { AdminPlace } from "../actions";

const place = {
  phone: "+52 322 378 0016",
  whatsapp_url: "https://wa.me/523223780016",
  instagram_url: "https://instagram.com/strana",
  website_url: "https://grupoalme.mx/strana",
} as AdminPlace;

describe("serving channels", () => {
  it("is Phone, WhatsApp, Instagram, Web Link, Not", () => {
    expect([...SERVING_CHANNELS]).toEqual([
      "phone",
      "whatsapp",
      "instagram",
      "web",
      "none",
    ]);
  });

  it("reads only those five keys", () => {
    expect(readChannel("phone")).toBe("phone");
    expect(readChannel("whatsapp")).toBe("whatsapp");
    expect(readChannel("instagram")).toBe("instagram");
    expect(readChannel("web")).toBe("web");
    expect(readChannel("none")).toBe("none");
    expect(readChannel("email")).toBe("");
    expect(readChannel(null)).toBe("");
    expect(isServingChannel("web")).toBe(true);
    expect(isServingChannel("voice")).toBe(false);
  });

  it("resolves a contact snapshot per door, none has no target", () => {
    expect(contactForChannel(place, "phone")).toContain("322");
    expect(contactForChannel(place, "whatsapp")).toBe("+523223780016");
    expect(contactForChannel(place, "instagram")).toBe("@strana");
    expect(contactForChannel(place, "web")).toBe("https://grupoalme.mx/strana");
    expect(contactForChannel(place, "none")).toBe("");
    expect(targetForChannel(place, "none")).toBeNull();
    expect(targetForChannel(place, "web")).toBe("https://grupoalme.mx/strana");
  });
});
