import { Eye } from "lucide-react";

// One sidebar entry — "Ojo Config". Ojo (Spanish "eye"; "¡Ojo!" = watch out)
// is the proof-verification engine: it reads the screenshot a guest posts for
// an Instagram story or a Google review and returns a verdict. Sits next to
// Verification Config, which governs PLACE ownership proof — different
// subject, same "is this real?" family.
export const OJO_PARENT = {
  href: "/ojo-config",
  label: "Ojo Config",
  Icon: Eye,
} as const;
