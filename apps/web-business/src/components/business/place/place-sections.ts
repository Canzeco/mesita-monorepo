export type PlaceSectionId =
  | "preview"
  | "basics"
  | "about"
  | "products"
  | "hours"
  | "location"
  | "channels"
  | "media"
  | "details"
  | "reviews"
  | "progress";

export const PLACE_SECTIONS: readonly {
  id: PlaceSectionId;
  label: string;
  description?: string;
  inNav?: boolean;
}[] = [
  {
    id: "basics",
    label: "Basics",
    description: "Identity, location, hours, and description.",
  },
  {
    id: "about",
    label: "About",
    description: "A short description of your place.",
  },
  {
    id: "products",
    label: "Menu",
    description: "Link or upload your menu or catalog.",
  },
  {
    id: "hours",
    label: "Hours",
    description: "When you're open each day.",
  },
  {
    id: "location",
    label: "Location",
    description: "Address and map.",
  },
  {
    id: "channels",
    label: "Channels",
    description: "Where guests find and reach you.",
  },
  {
    id: "media",
    label: "Media",
    description: "Photos and menu.",
  },
  {
    id: "details",
    label: "From Google",
    description: "Status and info synced from Google.",
    inNav: false,
  },
  {
    id: "reviews",
    label: "Reviews",
    description: "Ratings and snippets from Mesita and Google.",
  },
  {
    id: "preview",
    label: "Preview",
    description: "How your place looks to guests.",
  },
  {
    id: "progress",
    label: "Profile progress",
    description: "Complete these items to improve your listing.",
    inNav: false,
  },
];

export const PLACE_NAV_SECTIONS = PLACE_SECTIONS.filter(
  (section) => section.inNav !== false,
);

export function placeSectionDomId(id: PlaceSectionId): string {
  return `place-${id}`;
}

export function placeSectionLabel(id: PlaceSectionId): string {
  return PLACE_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

export function placeSectionDescription(id: PlaceSectionId): string | undefined {
  return PLACE_SECTIONS.find((section) => section.id === id)?.description;
}
