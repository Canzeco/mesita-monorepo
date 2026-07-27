// The consumer chat renders Memo's reply as RAW TEXT, so any markdown the
// model emits (**bold**, *italics*, `code`, # headings, [links](url)) leaks
// through as literal symbols. Strip the formatting markers but keep the words —
// and keep emojis, accents (á/ñ), and ¡¿ punctuation untouched.
//
// Shared by the consumer concierge (consumer-web-ask-memo) and the admin
// playground (admin-web-ask-memo) so both surfaces show the same clean prose.
export function toPlainText(s: string): string {
  return s
    // Links: [text](url) → text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // Bold / italic / strikethrough wrappers → their inner text
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, "$2")
    // Inline code / fenced code → inner text
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    // Heading (#) and blockquote (>) markers at line start
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    // Any stray emphasis/heading/code markers left over
    .replace(/[*_`#]/g, "")
    .trim();
}
