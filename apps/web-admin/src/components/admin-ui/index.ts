// Admin shared UI kit — one import root for console chrome.
//
// Surfaces (see apps/web-admin/DESIGN.md):
//   config  — flat/tabbed config pages (canonical for greenfield)
//   manage  — single-unit records editor
//
// Prefer `@/components/admin-ui` (or `/config` `/manage`) over the legacy
// route-local shims (`enricher-config/atlas-ui`, `manage-single/ui`).

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
} from "./config";

export {
  SectionCard as ManageSectionCard,
  GroupLabel,
  TextField,
  PhoneField,
  TextArea,
  SelectField,
  SaveBar,
  ConfirmDialog,
  Spinner,
  ReadField,
  OpenLink,
  CopyIdButton,
  type Tint,
} from "./manage";

export { ErrorNote } from "@/components/ErrorNote";
export { AtlasSettingsError } from "@/components/AtlasSettingsError";
export { ERROR_BOX_CLASS } from "@/lib/ui-classes";
