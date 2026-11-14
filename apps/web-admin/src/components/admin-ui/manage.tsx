import { SectionCard as KitSectionCard } from "./card";
import { BONE_CLASS as KIT_BONE_CLASS, CARD_CLASS, CARD_SURFACE_CLASS as KIT_SURFACE } from "./classes";

// `@/components/admin-ui/manage` — dissolved into the kit (MESITA-3948).
// What is left are deprecated wrappers for this file's remaining callers;
// Waves 2–3 move them to "@/components/admin-ui" and delete this file. No
// "use client" and no re-export of a client module: the shared loading screen
// imports BONE_CLASS from here, and every client module it reaches ships to
// every route.

/** @deprecated the card paints its icon muted; Waves 2–3 delete every `tint=`. */
export type Tint =
  | "rose"
  | "pink"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "teal"
  | "orange"
  | "indigo"
  | "slate";

/** @deprecated use { SectionCard } from "@/components/admin-ui" */
export const CARD_SURFACE_CLASS = KIT_SURFACE;
/** @deprecated use { SectionCard } or { Skeleton } from "@/components/admin-ui" */
export const SECTION_CARD_CLASS = CARD_CLASS;
/** @deprecated use { Skeleton } from "@/components/admin-ui" */
export const BONE_CLASS = KIT_BONE_CLASS;

/**
 * @deprecated use { SectionCard } from "@/components/admin-ui" with `right`.
 * Wave 1 wrapper: `action` maps to `right`; `tint` is accepted and ignored.
 */
export function SectionCard({
  id,
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  id?: string;
  icon?: React.ReactNode;
  /** @deprecated ignored: the card paints its icon muted */
  tint?: Tint;
  title: string;
  subtitle?: string;
  /** @deprecated pass `right` to the kit SectionCard */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <KitSectionCard id={id} icon={icon} title={title} subtitle={subtitle} right={action}>
      {children}
    </KitSectionCard>
  );
}
