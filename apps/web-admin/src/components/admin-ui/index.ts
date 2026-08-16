// Admin shared UI kit — one import root for console chrome.
//
// Surfaces (see the web-admin design map (Notion Product Rules §F)):
//   config  — flat/tabbed config pages (canonical for greenfield)
//   manage  — single-unit records editor
//   lineup  — scoring / lineup panels only
//
// Prefer `@/components/admin-ui` (or `/config` `/manage` `/lineup`) over the
// legacy route-local shims (`enricher-config/atlas-ui`, `manage-single/ui`,
// `lineup-config/panel-ui`).

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

export {
  SubHead,
  Chip,
  MiniTile,
  Slider,
  PanelCard,
  BoxSection,
  ContextCols,
  EmContextCols,
  BoxSaveBar,
  CARD_ACCENTS,
  type CardTint,
} from "./lineup";

export { ErrorNote } from "@/components/ErrorNote";
export { AtlasSettingsError } from "@/components/AtlasSettingsError";
export { ERROR_BOX_CLASS } from "@/lib/ui-classes";
