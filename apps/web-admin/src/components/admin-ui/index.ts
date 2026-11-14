// The admin kit (MESITA-3948): every caller imports from
// "@/components/admin-ui" and nowhere deeper. Kit files import each other
// directly, never through this barrel.
export { PageContainer, PageHeader, ConfigPageLayout, PAGE_BAND_CLASS } from "./layout";
export { SectionCard, Stat } from "./card";
export { Button, buttonClass, type ButtonTone, type ButtonSize } from "./button";
export {
  FieldWell,
  TextField,
  SearchField,
  TextAreaField,
  SelectField,
  NumberField,
  PhoneField,
  ReadField,
} from "./field";
export { Chip, type ChipTone } from "./chip";
export { Notice, type NoticeTone } from "./notice";
export { Table, THead, TBody, Tr, Th, Td } from "./table";
export { Spinner, Skeleton, EmptyState, Soon } from "./states";
export { ConfirmDialog } from "./dialog";
export { SaveBar } from "./save";
export { Switch, SwitchRow, ChoicePill, Collapsible } from "./controls";
export {
  FOCUS_RING_CLASS,
  FOCUS_RING_ON_DARK_CLASS,
  TOUCH_TARGET_CLASS,
  OVERLAY_SURFACE_CLASS,
  DRAWER_SURFACE_CLASS,
  STICKY_COL_HEAD,
  STICKY_COL_CELL,
} from "./classes";
