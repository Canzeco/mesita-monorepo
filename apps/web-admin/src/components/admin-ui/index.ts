// Admin shared UI kit — one import root for console chrome.
//
// Surfaces (see the web-admin design map (Notion Docs › Design)):
//   config  — flat/tabbed config pages (canonical for greenfield)
//   manage  — records editors (cards, filled inputs, SaveBar)
//
// Prefer `@/components/admin-ui` (or `/config` `/manage`) over route-local
// files.

export {
  KnobState,
  SectionCard,
  Collapsible,
  Switch,
  TextAreaField,
  NumberField,
  ChoiceField,
  QueryConcatCaps,
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
