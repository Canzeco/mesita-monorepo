import { Flame } from "lucide-react";

// The brand reference — a reading surface, not a config. It has no knobs and
// writes nothing; it renders the shipped tokens and the real logo components
// so a drift between the guide and the product is visible immediately.
// The authored source is assets/brand/brand.json (guide: Notion Product Rules §F).
export const BRAND_PARENT = {
  href: "/brand",
  label: "Brand",
  Icon: Flame,
} as const;
