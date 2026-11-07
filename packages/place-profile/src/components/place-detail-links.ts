import { AtSign, Bike, CalendarCheck, Globe, MapPin, MessageCircle } from "lucide-react";

import { Facebook, Instagram, Twitter } from "./brand-icons";

// `logo` points at a real brand mark in /public/channels (simple-icons SVG,
// brand colour baked in) so the Channels chips read as the actual apps.
// Channels without an available brand SVG (Website generic, OpenTable, Resy,
// DiDi Food) keep their neutral lucide `Icon` fallback.
//
// EACH LINK WEARS ITS BRAND'S OWN BACKGROUND (Pato, MESITA-3320: "use
// different background for the boxes of links and other icons to contrast
// with background. for example, Uber Eats must be green and so on. search
// all the stupid icons"): `tone` is a pale brand tint under brand ink, the
// voucher marks' form (bg-x-100 / text-x-700), never a solid fill with
// white text. MESITA-2636's one grey button is gone for these.
export const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe, tone: "bg-sky-100 text-sky-800" },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    Icon: MessageCircle,
    logo: "/channels/whatsapp.svg",
    tone: "bg-green-100 text-green-800",
  },
  {
    key: "instagram_url",
    label: "Instagram",
    Icon: Instagram,
    logo: "/channels/instagram.svg",
    tone: "bg-pink-100 text-pink-800",
  },
  {
    key: "facebook_url",
    label: "Facebook",
    Icon: Facebook,
    logo: "/channels/facebook.svg",
    tone: "bg-blue-100 text-blue-800",
  },
  { key: "x_url", label: "X", Icon: Twitter, logo: "/channels/x.svg", tone: "bg-neutral-200 text-neutral-900" },
  {
    key: "threads_url",
    label: "Threads",
    Icon: AtSign,
    logo: "/channels/threads.svg",
    tone: "bg-neutral-200 text-neutral-900",
  },
  {
    key: "reddit_url",
    label: "Reddit",
    Icon: MessageCircle,
    logo: "/channels/reddit.svg",
    tone: "bg-orange-100 text-orange-800",
  },
] as const;

/** Phone's tone: a call is green, as the phone app is. */
export const PHONE_TONE = "bg-emerald-100 text-emerald-800";

export const RESERVATION_DEFS = [
  {
    key: "opentable_url",
    label: "OpenTable",
    Icon: CalendarCheck,
    logo: "/channels/opentable.svg",
    tone: "bg-red-100 text-red-800",
  },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck, tone: "bg-rose-100 text-rose-800" },
  {
    key: "uber_eats_url",
    // decision: Pato — real Uber Eats Simple Icons mark (green stacked
    // wordmark), not the fake green app-square with "eats" lettering. The
    // label is the brand, not a verb (Pato, MESITA-3151: "say Uber Eats,
    // don't say pedir").
    label: "Uber Eats",
    Icon: Bike,
    logo: "/channels/ubereats-mark.svg",
    // Uber Eats is green (Pato, MESITA-3320).
    tone: "bg-green-100 text-green-800",
  },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike, tone: "bg-orange-100 text-orange-800" },
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
  },
] as const;

