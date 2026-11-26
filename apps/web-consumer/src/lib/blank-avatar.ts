// Instagram's anonymous person, saved as a photo (MESITA-5003). It is two
// greys on a light field, so Me treated the URL as a picture and hid the
// camera. A face is saturated and is not this.

const SAMPLE = 24;
const LIGHT = 220;
/** (max − min) / max below this is still grey. The anonymous icon peaks
 *  near 0.13; a face is well above. */
const SATURATION = 0.2;
/** Share of the square that is the icon's light background. */
const LIGHT_SHARE = 0.45;

/** True when this loaded image is the grey person, not a photograph. */
export function isBlankPersonIcon(img: HTMLImageElement): boolean {
  if (!img.naturalWidth || !img.naturalHeight) return false;
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  let data: Uint8ClampedArray;
  try {
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return false;
  }
  const pixels = SAMPLE * SAMPLE;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 0 && (max - min) / max >= SATURATION) return false;
    // Rec. 709 luminance, integer: 0.2126, 0.7152, 0.0722.
    const lum = (54 * r + 183 * g + 18 * b) >> 8;
    if (lum > LIGHT) light += 1;
  }
  return light / pixels >= LIGHT_SHARE;
}
