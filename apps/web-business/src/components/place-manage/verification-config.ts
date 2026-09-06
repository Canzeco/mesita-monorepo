import { Mail, MessageSquare, Phone, Video } from "lucide-react";

export const METHOD_ICON = {
  ai_call: Phone,
  ai_email: Mail,
  video: Video,
  postcard: Mail,
  manual_contact: MessageSquare,
} as const;

export const METHOD_LABEL = {
  ai_call: "AI phone call",
  ai_email: "AI email",
  video: "Walkthrough video",
  postcard: "Postcard",
  manual_contact: "Manual contact",
} as const;

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "";
  const known = METHOD_LABEL[method as keyof typeof METHOD_LABEL];
  if (known) return known;
  const clean = method.replace(/_/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
}
