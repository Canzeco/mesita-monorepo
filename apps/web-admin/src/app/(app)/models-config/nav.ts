import { Cpu } from "lucide-react";

// Folded into General (MESITA-1175). The route survives as a redirect;
// this export is the label SoT if anything still names the card.
export const MODELS_PARENT = {
  href: "/models-config",
  label: "Models",
  Icon: Cpu,
} as const;
