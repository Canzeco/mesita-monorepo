/** Menu URL helpers — kind detection + Drive preview embeds for the viewer. */

export type MenuKind = "image" | "pdf" | "drive";

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;

function isDriveMenuUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const host = parsed.hostname.toLowerCase();
    return host.includes("drive.google.com") || host.includes("docs.google.com");
  } catch {
    return false;
  }
}

export function detectMenuKind(url: string): MenuKind {
  const trimmed = url.trim();
  if (!trimmed) return "pdf";
  if (isDriveMenuUrl(trimmed)) return "drive";
  if (IMAGE_EXT.test(trimmed) || /\/menu-images\//i.test(trimmed)) return "image";
  if (PDF_EXT.test(trimmed) || /\/menu-pdfs\//i.test(trimmed)) return "pdf";
  // Unknown Storage/public URL — prefer PDF viewer (images still render if wrong).
  return "pdf";
}

/** Convert a Drive/Docs share link into an embeddable /preview URL when possible. */
export function drivePreviewUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || !isDriveMenuUrl(trimmed)) return null;
  try {
    const parsed = new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    // /file/d/<id>/view|edit|preview → /file/d/<id>/preview
    const fileMatch = path.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // open?id=<id> or uc?id=<id>
    const id = parsed.searchParams.get("id");
    if (id) {
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    // docs.google.com/{document|spreadsheets|presentation}/d/<id>/…
    if (host.includes("docs.google.com")) {
      const docMatch = path.match(
        /\/(document|spreadsheets|presentation)\/d\/([^/]+)/,
      );
      if (docMatch?.[1] && docMatch[2]) {
        return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function menuKindLabel(kind: MenuKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "drive":
      return "Google Drive";
  }
}

export function menuSubtitle(opts: {
  kind: MenuKind;
  pages: number | null;
  updated_label?: string;
}): string {
  const parts: string[] = [];
  if (opts.kind === "image") {
    const n = opts.pages && opts.pages > 0 ? opts.pages : 1;
    parts.push(n === 1 ? "1 page" : `${n} pages`);
  } else {
    parts.push(menuKindLabel(opts.kind));
  }
  if (opts.updated_label?.trim()) parts.push(opts.updated_label.trim());
  return parts.join(" · ");
}
