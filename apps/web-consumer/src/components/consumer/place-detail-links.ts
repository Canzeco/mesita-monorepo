import {
  AtSign,
  Bike,
  CalendarCheck,
  Facebook,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  Twitter,
} from "lucide-react";

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
    label: "OpenTable",
    Icon: CalendarCheck,
    logo: "/channels/opentable.svg",
  },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck },
  {
    key: "uber_eats_url",
    // decision: Pato — real Uber Eats Simple Icons mark (green stacked
    // wordmark), not the fake green app-square with "eats" lettering.
    label: "Uber Eats",
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
    logo: "/channels/googlemaps.svg",
  },
] as const;

// Soft clay brand tints for Channels chips — just a bit of each brand's
// color so the row reads as real apps, not a flat grey wall. Unknown keys
// fall back to the neutral surface.
export const CHANNEL_CLAY: Record<string, string> = {
  phone: "border-emerald-200/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70",
  website_url: "border-sky-200/70 bg-sky-50 text-sky-900 hover:bg-sky-100/70",
  whatsapp_url:
    "border-emerald-200/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70",
  instagram_url: "border-pink-200/70 bg-pink-50 text-pink-900 hover:bg-pink-100/70",
  facebook_url: "border-blue-200/70 bg-blue-50 text-blue-900 hover:bg-blue-100/70",
  x_url: "border-zinc-300/70 bg-zinc-100 text-zinc-900 hover:bg-zinc-200/70",
  threads_url: "border-zinc-300/70 bg-zinc-100 text-zinc-900 hover:bg-zinc-200/70",
  reddit_url: "border-orange-200/70 bg-orange-50 text-orange-900 hover:bg-orange-100/70",
  opentable_url: "border-red-200/70 bg-red-50 text-red-900 hover:bg-red-100/70",
  resy_url: "border-rose-200/70 bg-rose-50 text-rose-900 hover:bg-rose-100/70",
  uber_eats_url:
    "border-green-200/70 bg-green-50 text-green-900 hover:bg-green-100/70",
  didi_food_url:
    "border-orange-200/70 bg-orange-50 text-orange-900 hover:bg-orange-100/70",
  google_maps_url:
    "border-amber-200/70 bg-amber-50 text-amber-950 hover:bg-amber-100/70",
};

// Per-facet chip tint. Each of the 17 taxonomy facets gets its own light
// tone (bg / text / border) plus a leading dot so the cluster reads as a
// differentiated, premium chip set rather than one flat grey wall. Mirrors
// RatePill's "banded/tinted by value" idea, applied per facet group instead
// of per percent. Unknown facets fall back to a neutral slate tone.
export const FACET_TINT: Record<string, { chip: string; dot: string }> = {
  payment: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  booking: { chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  service: {
    chip: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
  },
  vibe: {
    chip: "bg-pink-50 text-pink-700 border-pink-200",
    dot: "bg-pink-500",
  },
  occasion: {
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  amenities: {
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  dietary: {
    chip: "bg-lime-50 text-lime-700 border-lime-200",
    dot: "bg-lime-500",
  },
  menu: {
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  drinks: {
    chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    dot: "bg-fuchsia-500",
  },
  entertainment: {
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  crowd: {
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-500",
  },
  setting: {
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  hours: {
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  dress: {
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  wellness: {
    chip: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  experiences: {
    chip: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  values: {
    chip: "bg-yellow-50 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
  },
};

export const FACET_TINT_FALLBACK = {
  chip: "bg-slate-50 text-slate-700 border-slate-200",
  dot: "bg-slate-400",
};
