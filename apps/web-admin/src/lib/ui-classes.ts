// @deprecated (MESITA-3948): the kit's class strings live in
// `@/components/admin-ui` (classes.ts). These re-exports render the new skin
// until Waves 2–3 move their callers; Wave 3 deletes this file.
import { buttonClass } from "@/components/admin-ui/button";

/** @deprecated use { Notice } from "@/components/admin-ui" */
export const ERROR_BOX_CLASS =
  "rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive";

/** @deprecated import from "@/components/admin-ui" */
export {
  FOCUS_RING_CLASS,
  FOCUS_RING_ON_DARK_CLASS,
  TOUCH_TARGET_CLASS,
  STICKY_COL_HEAD,
  STICKY_COL_CELL,
} from "@/components/admin-ui/classes";

/** @deprecated use { Button } from "@/components/admin-ui" size="sm" */
export const PILL_BUTTON_CLASS = buttonClass({ size: "sm" });

/** @deprecated use { Button } from "@/components/admin-ui" */
export const CTA_BUTTON_CLASS = buttonClass();
