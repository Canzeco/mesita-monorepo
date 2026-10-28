import { AtSign, Bike, CalendarCheck, Globe, MapPin, MessageCircle } from "lucide-react";

import { Facebook, Instagram, Twitter } from "./brand-icons";

// `logo` points at a real brand mark in /public/channels (simple-icons SVG,
// brand colour baked in) so the Channels chips read as the actual apps.
// Channels without an available brand SVG (Website generic, OpenTable, Resy,
// DiDi Food) keep their neutral lucide `Icon` fallback.
export const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    Icon: MessageCircle,
    logo: "/channels/whatsapp.svg",
  },
  {
    key: "instagram_url",
    label: "Instagram",
    Icon: Instagram,
    logo: "/channels/instagram.svg",
  },
  {
    key: "facebook_url",
    label: "Facebook",
    Icon: Facebook,
    logo: "/channels/facebook.svg",
  },
  { key: "x_url", label: "X", Icon: Twitter, logo: "/channels/x.svg" },
  {
    key: "threads_url",
    label: "Threads",
    Icon: AtSign,
    logo: "/channels/threads.svg",
  },
  {
    key: "reddit_url",
    label: "Reddit",
    Icon: MessageCircle,
    logo: "/channels/reddit.svg",
  },
] as const;

export const RESERVATION_DEFS = [
  {
    key: "opentable_url",
    label: "Reservar",
    Icon: CalendarCheck,
    logo: "/channels/opentable.svg",
  },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck },
  {
    key: "uber_eats_url",
    // decision: Pato — real Uber Eats Simple Icons mark (green stacked
    // wordmark), not the fake green app-square with "eats" lettering.
    label: "Pedir",
    Icon: Bike,
    logo: "/channels/ubereats-mark.svg",
  },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike },
] as const;

export const REVIEW_DEFS = [
  {
    key: "google_maps_url",
    label: "Google Maps",
    Icon: MapPin,
    // The Google G, not the Maps pin (Pato, MESITA-2927: "use the fucking
    // google logo").
    logo: "/channels/google.svg",
  },
] as const;

