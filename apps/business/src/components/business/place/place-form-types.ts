import type { DayKey, DayShifts } from "./place-hours";

export type MenuEntry = { name: string; url: string };

export type PlaceFormState = {
  name: string;
  category: string;
  description: string;
  hours: Record<DayKey, DayShifts>;
  menu_links: MenuEntry[];
  photos: string[];
  tags: string[];
  phone: string;
  whatsapp_url: string;
  email: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  threads_url: string;
  reddit_url: string;
  opentable_url: string;
  resy_url: string;
  tripadvisor_url: string;
  google_maps_url: string;
  uber_eats_url: string;
  didi_food_url: string;
};

export type SetPlaceForm = <K extends keyof PlaceFormState>(
  key: K,
  value: PlaceFormState[K],
) => void;
