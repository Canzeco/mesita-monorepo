// Ticket proof screenshots (MESITA-1030 · mobile port MESITA-1094): the
// guest attaches a screenshot of their Google review / Instagram story as
// the proof. Uploaded straight to the public `ticket-proofs` bucket as the
// signed-in JWT — same house pattern as consumer-avatars (RLS restricts
// writes to the caller's own {consumer_id}/ folder) — then the public URL
// rides the submit EF, which pins it to the ticket row. Nothing inspects the
// image; any screenshot completes the task (self-attest posture, with an
// artifact). Unlike web there is no canvas re-encode on native: the picker
// already hands us a compressed JPEG, and the bucket's 4 MiB cap is the
// backstop.

import * as ImagePicker from "expo-image-picker";

import { supabase } from "@/lib/supabase";

const TICKET_PROOFS_BUCKET = "ticket-proofs";
const MAX_PROOF_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  const declared =
    asset.mimeType === "image/jpg" ? "image/jpeg" : asset.mimeType;
  if (declared && ALLOWED_MIME.has(declared)) return declared;
  const lower = asset.uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Open the library and return the picked screenshot, or null on cancel. */
export async function pickProofScreenshot(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Allow photo access to attach your screenshot.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/** Upload a picked screenshot and return its public URL. */
export async function uploadTicketProof(
  userId: string,
  ticketId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const mime = mimeFromAsset(asset);
  const response = await fetch(asset.uri);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0) {
    throw new Error("That file looks empty. Pick another screenshot.");
  }
  if (buffer.byteLength > MAX_PROOF_BYTES) {
    throw new Error("Screenshot is too large (max 4 MB). Pick a smaller one.");
  }

  const path = `${userId}/${ticketId}-${Date.now()}.${extForMime(mime)}`;
  const { error } = await supabase.storage
    .from(TICKET_PROOFS_BUCKET)
    .upload(path, buffer, {
      upsert: false,
      contentType: mime,
      cacheControl: "31536000",
    });
  if (error) {
    throw new Error(`Couldn't upload the screenshot: ${error.message}`);
  }
  const { data } = supabase.storage
    .from(TICKET_PROOFS_BUCKET)
    .getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Couldn't resolve the uploaded screenshot URL.");
  }
  return data.publicUrl;
}
