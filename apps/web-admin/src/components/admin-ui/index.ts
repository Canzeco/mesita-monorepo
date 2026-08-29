// Admin shared UI kit — one import root for console chrome.
//
// Surfaces (see the web-admin design map (Notion Docs › Design)):
//   config  — flat/tabbed config pages (canonical for greenfield)
//   manage  — single-place records editor
//
// Prefer `@/components/admin-ui` (or `/config` `/manage`) over route-local
// files. `manage-single/ui` is only `CrossTabLink` (needs PlaceContext).

export {
  KnobStatus,
  SectionCard,
  Collapsible,
  Switch,
  TextAreaField,
  NumberField,
  ChoiceField,
  LaneMergeFunnel,
  Button,
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
export { ERROR_BOX_CLASS } from "@/lib/ui-classes";
