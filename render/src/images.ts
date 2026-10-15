// Google already gathered the place's photos. This ranks that set best-first
// for a should-we-go-tonight decision, then the write copies the bytes.
// The wording matches the enrichment config defaults. A failed rank keeps
// Google's order, so a vision miss still brings the photos.

const SAVE = 10;
const VISION_MODEL = "gpt-4o-mini";

const ANALYSIS_PROMPT =
  "Describe this place photo: subject (ambience / interior / exterior / food / people / detail), visual quality, lighting, and whether it is representative and appealing. Be concise and factual.";

const SORTING_PROMPT =
  "Rank these place photos best to worst for a should-we-go-tonight decision. We sell EXPERIENCES: weight beautiful place / ambience / vibe shots EQUALLY with food. Favor visual quality, representativeness, and a balanced mix. Drop duplicates, blurry, dark, or text-heavy images.";

type FetchImpl = typeof fetch;

export function applyPhotoOrder(urls: string[], raw: unknown): string[] {
  const order = normaliseOrder(raw, urls.length);
  if (!order) return urls.slice(0, SAVE);
  return order.map((index) => urls[index]).filter((url): url is string => !!url).slice(0, SAVE);
}

function normaliseOrder(raw: unknown, length: number): number[] | null {
  if (!Array.isArray(raw)) return null;
  const order: number[] = [];
  const seen = new Set<number>();
  for (const value of raw) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(n) && n >= 0 && n < length && !seen.has(n)) {
      order.push(n);
      seen.add(n);
    }
  }
  for (let i = 0; i < length; i++) {
    if (!seen.has(i)) order.push(i);
  }
  return order;
}

export async function sortPlacePhotos(
  urls: string[],
  openaiKey: string | undefined,
  fetchImpl: FetchImpl = fetch,
): Promise<string[]> {
  const photos = urls.filter((url) => url.startsWith("https://")).slice(0, SAVE);
  const key = openaiKey?.trim() ?? "";
  if (photos.length < 2 || !key) return photos;
  try {
    const descriptions = await describePhotos(fetchImpl, key, photos);
    if (!descriptions || descriptions.every((line) => !line)) return photos;
    const order = await rankPhotos(fetchImpl, key, descriptions);
    return order ? applyPhotoOrder(photos, order) : photos;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[images] ${why.slice(0, 200)}`);
    return photos;
  }
}

async function describePhotos(fetchImpl: FetchImpl, apiKey: string, urls: string[]): Promise<string[] | null> {
  const descriptions = await Promise.all(urls.map((url) => describeOne(fetchImpl, apiKey, url)));
  return descriptions.every((line) => !line) ? null : descriptions;
}

async function describeOne(fetchImpl: FetchImpl, apiKey: string, url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            { type: "image_url", image_url: { url, detail: "low" } },
          ],
        }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return "";
    const body = await res.json() as { choices?: { message?: { content?: string } }[] };
    return (body.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function rankPhotos(fetchImpl: FetchImpl, apiKey: string, descriptions: string[]): Promise<unknown> {
  const list = descriptions.map((line, index) => `${index}: ${line || "(no description)"}`).join("\n");
  const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      messages: [{
        role: "user",
        content:
          `${SORTING_PROMPT}\n\nImages (index: description):\n${list}\n\n` +
          'Return a SINGLE JSON object {"order": [indices best-to-worst]}. ' +
          "Include EVERY index exactly once; do not drop any. No prose, no fences.",
      }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    return (JSON.parse(text) as { order?: unknown }).order ?? null;
  } catch {
    return null;
  }
}
