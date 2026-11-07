import { AtSign, Bike, CalendarCheck, Globe, MapPin, MessageCircle } from "lucide-react";

import { Facebook, Instagram, Twitter } from "./brand-icons";

// `logo` points at a real brand mark in /public/channels (simple-icons SVG,
// brand colour baked in) so the Channels chips read as the actual apps.
// Channels without an available brand SVG (Website generic, OpenTable, Resy,
// DiDi Food) keep their neutral lucide `Icon` fallback.
//
// EACH LINK IS THE QUIET GREY CHIP, ONLY ITS MARK IN THE BRAND'S COLOUR
// (Pato, MESITA-3340: "better keep the gray buttons below. too strong
// buttons is an incentive for them to leave the app. keep discrete gray
// buttons, but logos with colors"): `mark` is the brand's colour for the
// logo or glyph, painted through a mask over the monochrome brand SVG; the
// chip itself is MESITA-2636's one grey button again. MESITA-3320's pale
// tints and MESITA-3333's solid brand fills under white are gone. Google
// keeps its four-colour G as the file paints it (`logoAsIs`).
export const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe, mark: "text-sky-600" },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    Icon: MessageCircle,
    logo: "/channels/whatsapp.svg",
    mark: "text-[#25D366]",
  },
  {
    key: "instagram_url",
    label: "Instagram",
    Icon: Instagram,
    logo: "/channels/instagram.svg",
    mark: "text-[#E4405F]",
  },
  {
    key: "facebook_url",
    label: "Facebook",
    Icon: Facebook,
    logo: "/channels/facebook.svg",
    mark: "text-[#0866FF]",
  },
  { key: "x_url", label: "X", Icon: Twitter, logo: "/channels/x.svg", mark: "text-foreground" },
  {
    key: "threads_url",
    label: "Threads",
    Icon: AtSign,
    logo: "/channels/threads.svg",
    mark: "text-foreground",
  },
  {
    key: "reddit_url",
    label: "Reddit",
    Icon: MessageCircle,
    logo: "/channels/reddit.svg",
    mark: "text-[#FF4500]",
  },
] as const;

/** Phone's mark: a call is green, as the phone app is. */
export const PHONE_MARK = "text-emerald-600";

export const RESERVATION_DEFS = [
  {
    key: "opentable_url",
    label: "OpenTable",
    Icon: CalendarCheck,
    logo: "/channels/opentable.svg",
    mark: "text-[#DA3743]",
  },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck, mark: "text-[#FF462D]" },
  {
    key: "uber_eats_url",
    // decision: Pato — real Uber Eats Simple Icons mark (green stacked
    // wordmark), not the fake green app-square with "eats" lettering. The
    // label is the brand, not a verb (Pato, MESITA-3151: "say Uber Eats,
    // don't say pedir").
    label: "Uber Eats",
    Icon: Bike,
    logo: "/channels/ubereats-mark.svg",
    // Uber Eats green with the Uber Eats mark (Pato, MESITA-3320, MESITA-3333).
    mark: "text-[#06C167]",
  },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike, mark: "text-[#FF7D41]" },
] as const;

export const REVIEW_DEFS = [
  {
    key: "google_maps_url",
    label: "Google Maps",
    Icon: MapPin,
    // The Google G, not the Maps pin (Pato, MESITA-2927: "use the fucking
    // google logo"), on Google's light grey tile (MESITA-2963).
    logo: "/channels/google.svg",
    logoAsIs: true,
  },
] as const;

