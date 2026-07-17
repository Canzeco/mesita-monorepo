import { Mail, Phone, Video } from "lucide-react";

export const METHOD_ICON = {
  ai_call: Phone,
  video: Video,
  postcard: Mail,
} as const;

export const METHOD_LABEL = {
  ai_call: "AI phone call",
  video: "Walkthrough video",
  postcard: "Postcard",
} as const;
