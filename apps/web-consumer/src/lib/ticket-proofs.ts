"use client";

// Ticket proof screenshots (MESITA-1030): the guest attaches a screenshot of
// their Google review / Instagram story as the proof. Uploaded straight to
// the public `ticket-proofs` bucket as the signed-in JWT — the same house
// pattern as consumer-avatars (RLS restricts writes to the caller's own
// {consumer_id}/ folder) — then the public URL rides the submit EF, which
// pins it to the ticket row. Nothing inspects the image; any screenshot
// completes the task (MESITA-849's self-attest posture, now with an artifact).

import type { SupabaseClient } from "@supabase/supabase-js";

const TICKET_PROOFS_BUCKET = "ticket-proofs";

// Bucket caps at 4 MiB; a re-encoded screenshot lands around 200-500 KB, so
// uploads stay fast on venue wifi. Screenshots are text-heavy — 0.85 JPEG at
// ≤1600px keeps them legible.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
const MAX_ORIGINAL_BYTES = 4 * 1024 * 1024;
const PASSTHROUGH_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> decoder (some formats/browsers).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downscale + re-encode to JPEG. Falls back to the original file when the
 *  browser can't decode it but the bucket would accept it as-is. */
async function toUploadBlob(
  file: File,
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  try {
    const img = await decodeImage(file);
    const w = "width" in img ? img.width : 0;
    const h = "height" in img ? img.height : 0;
    if (!w || !h) throw new Error("empty image");
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if ("close" in img) img.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("encode failed");
    return { blob, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    if (PASSTHROUGH_MIME.has(file.type) && file.size <= MAX_ORIGINAL_BYTES) {
      return {
        blob: file,
        contentType: file.type,
        ext: file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg",
      };
    }
    throw new Error("Use a JPG, PNG or WEBP screenshot under 4 MB.");
  }
}

/** Uploads the proof and returns its public URL for the submit EF. */
export async function uploadTicketProof(
  client: SupabaseClient,
  userId: string,
  ticketId: string,
  kind: "story" | "review",
  file: File,
): Promise<string> {
  const { blob, contentType, ext } = await toUploadBlob(file);
  // Timestamped name: proofs are immutable, a re-pick is a NEW object.
  const path = `${userId}/${ticketId}-${kind}-${Date.now()}.${ext}`;
  const { error } = await client.storage
    .from(TICKET_PROOFS_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) {
    throw new Error("Couldn't upload your screenshot — try again.");
  }
  const { data } = client.storage.from(TICKET_PROOFS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
