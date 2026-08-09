"use client";

// Thin re-export shim — implementation lives in `@/components/admin-ui/config`.
// Prefer importing from `@/components/admin-ui` (or `/config`) in new code.

export {
  KnobStatus,
  SectionCard,
  Collapsible,
  Switch,
  TextAreaField,
  NumberField,
  SaveRow,
  QualityPicker,
  type SynthesisQuality,
} from "@/components/admin-ui/config";
