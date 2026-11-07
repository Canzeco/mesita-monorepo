import { AtSign, Bike, CalendarCheck, Globe, MapPin, MessageCircle } from "lucide-react";

import { Facebook, Instagram, Twitter } from "./brand-icons";

// `logo` points at a real brand mark in /public/channels (simple-icons SVG,
// brand colour baked in) so the Channels chips read as the actual apps.
// Channels without an available brand SVG (Website generic, OpenTable, Resy,
// DiDi Food) keep their neutral lucide `Icon` fallback.
//
// EACH LINK IS ITS BRAND'S SOLID COLOUR, THE WORDS AND THE MARK WHITE
// (Pato, MESITA-3320: "use different background for the boxes of links ...
// Uber Eats must be green"; then MESITA-3333, with the pale tints: "the
// link colors look like shit, maybe darker with color, for example, uber
// eats with the fucking uber eats logo"): `tone` is the brand's own fill
// under white, and the chip paints the monochrome brand SVG white through
// a mask. Google keeps its four-colour G on its light grey tile
// (`logoAsIs`). MESITA-2636's one grey button is gone for these.
export const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe, tone: "bg-sky-600 text-white" },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    Icon: MessageCircle,
    logo: "/channels/whatsapp.svg",
    tone: "bg-[#25D366] text-white",
  },
  {
    key: "instagram_url",
    label: "Instagram",
    Icon: Instagram,
    logo: "/channels/instagram.svg",
    tone: "bg-[#E4405F] text-white",
  },
  {
    key: "facebook_url",
    label: "Facebook",
    Icon: Facebook,
    logo: "/channels/facebook.svg",
    tone: "bg-[#0866FF] text-white",
  },
  { key: "x_url", label: "X", Icon: Twitter, logo: "/channels/x.svg", tone: "bg-black text-white" },
  {
    key: "threads_url",
    label: "Threads",
    Icon: AtSign,
    logo: "/channels/threads.svg",
    tone: "bg-black text-white",
  },
  {
    key: "reddit_url",
    label: "Reddit",
    Icon: MessageCircle,
    logo: "/channels/reddit.svg",
    tone: "bg-[#FF4500] text-white",
  },
] as const;

/** Phone's tone: a call is green, as the phone app is. */
export const PHONE_TONE = "bg-emerald-600 text-white";

export const RESERVATION_DEFS = [
  {
    key: "opentable_url",
    label: "OpenTable",
    Icon: CalendarCheck,
    logo: "/channels/opentable.svg",
    tone: "bg-[#DA3743] text-white",
  },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck, tone: "bg-[#FF462D] text-white" },
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
    tone: "bg-[#06C167] text-white",
  },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike, tone: "bg-[#FF7D41] text-white" },
] as const;

export const REVIEW_DEFS = [
  {
    key: "google_maps_url",
    label: "Google Maps",
    Icon: MapPin,
    // The Google G, not the Maps pin (Pato, MESITA-2927: "use the fucking
    // google logo"), on Google's light grey tile (MESITA-2963).
    logo: "/channels/google.svg",
    tone: "bg-[#F1F3F4] text-foreground",
    logoAsIs: true,
  },
] as const;

