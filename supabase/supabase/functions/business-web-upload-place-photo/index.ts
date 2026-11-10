// Supabase Edge Function — business-web-upload-place-photo
//
// MESITA-3504. Profile's Photos box: one photo in, its URL out. Whoever runs
// the place (or a super-admin) uploads; anyone else gets 404. The photo is
// stored in place-images under business/<place>/, saved in the 160/640/1280
// sizes screens load (MESITA-2966). It does NOT touch the gallery: the
// Profile save (business-web-update-place,
// `photos`) puts it there, so a photo uploaded and never saved shows nowhere.
//
// Body: multipart/form-data { place_id: uuid, file: JPG | PNG | WEBP ≤ 8 MB (the bucket's own limits) }
// Response: { ok: true, url }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { savePhotoSizes } from "../_shared/photo-sizes.ts";
import { runInBackground } from "../_shared/background.ts";
import { businessPhotoPrefix } from "../_shared/place-media-update.ts";
import { MAX_PHOTO_BYTES, photoObjectPath, sniffImageType } from "./photo-upload.ts";

const BUCKET = "place-images";

serveJson("business-web-upload-place-photo", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user, env } = ctx;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "send multipart/form-data with place_id and file" }, 400);
  }
  const placeId = form.get("place_id");
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "file is required" }, 400);
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return json({ ok: false, code: "photo_too_large", error: "A photo can be up to 8 MB" }, 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return json({ ok: false, code: "not_a_photo", error: "Use a JPG, PNG or WEBP photo" }, 400);

  const path = photoObjectPath(placeId, type.ext);
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: type.mime,
    upsert: false,
    cacheControl: "31536000",
  });
  if (upErr) return json({ ok: false, error: `upload: ${upErr.message}` }, 500);

  const supabaseUrl = env.url ?? Deno.env.get("SUPABASE_URL") ?? "";
  const url = `${businessPhotoPrefix(supabaseUrl, placeId)}${path.slice(`business/${placeId}/`.length)}`;

  runInBackground(savePhotoSizes(admin, supabaseUrl, BUCKET, path));
  return json({ ok: true, url });
});
