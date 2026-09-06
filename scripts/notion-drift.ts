// scripts/notion-drift.ts — the Notion → repo hop, checked (ASDM I-8; Rules v7 decision D-E).
//
// Rules §0 in Notion is the master; scripts/rules-quickstart.md is its hand-mirrored copy.
// This fetches §0 (the blocks between the "0." heading and the first divider on the Rules
// page), flattens it to words, and compares those words with the quickstart's. Formatting
// never counts: links, emphasis, code marks and URLs are stripped on both sides.
//
//   NOTION_TOKEN=… deno run --allow-net=api.notion.com --allow-env=NOTION_TOKEN --allow-read scripts/notion-drift.ts
//
// Exit 0 = in sync, or SKIPPED because no token is set (never a silent green: it prints a
// warning and CI annotates it). Exit 1 = drift, with the first differing window. Exit 2 = the
// API could not be read.

export const RULES_PAGE_ID = "395a9bf37a528081b2c1dacc445bb6c8";
const QUICKSTART = new URL("./rules-quickstart.md", import.meta.url);
const API = "https://api.notion.com/v1";

type RichText = { plain_text: string }[];
type Block = { id: string; type: string; has_children?: boolean; [k: string]: unknown };

/** Words only: no markdown marks, no URLs, no case, no punctuation glued to words. */
export function normalize(text: string): string[] {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[`*_~\[\]()<>#\\|]/g, " ")
    .replace(/[“”"’']/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

export function firstDrift(a: string[], b: string[]): { at: number; notion: string; repo: string } | null {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      const win = (x: string[]) => x.slice(Math.max(0, i - 6), i + 8).join(" ");
      return { at: i, notion: win(a), repo: win(b) };
    }
  }
  return null;
}

/** The quickstart minus its H1 title, which is the repo file's name for the block, not §0 text. */
export function quickstartBody(md: string): string {
  return md.replace(/^# .*\n/, "");
}

function textOf(block: Block): string {
  const inner = block[block.type] as { rich_text?: RichText } | undefined;
  return (inner?.rich_text ?? []).map((r) => r.plain_text).join("");
}

async function children(id: string, token: string): Promise<Block[]> {
  const out: Block[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`${API}/blocks/${id}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" } });
    if (!r.ok) throw new Error(`Notion ${r.status} on blocks/${id}/children`);
    const j = await r.json() as { results: Block[]; has_more: boolean; next_cursor?: string };
    out.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function flatten(blocks: Block[], token: string): Promise<string[]> {
  const words: string[] = [];
  for (const b of blocks) {
    if (b.type === "divider") break;
    words.push(...normalize(textOf(b)));
    if (b.has_children) words.push(...await flatten(await children(b.id, token), token));
  }
  return words;
}

/** §0 = every block after the first heading whose text starts with "0." until the first divider. */
export async function section0Words(token: string): Promise<string[]> {
  const top = await children(RULES_PAGE_ID, token);
  const start = top.findIndex((b) => b.type.startsWith("heading") && textOf(b).trim().startsWith("0."));
  if (start < 0) throw new Error("no '0.' heading on the Rules page");
  const words = normalize(textOf(top[start]));
  const rest: string[] = await flatten(top.slice(start + 1), token);
  return [...words, ...rest];
}

if (import.meta.main) {
  const token = Deno.env.get("NOTION_TOKEN");
  if (!token) {
    console.log("::warning::SKIPPED: NOTION_TOKEN is not set — the Notion → repo hop is unchecked — add the secret from a Notion internal integration shared with the Rules page (ASDM I-8)");
    Deno.exit(0);
  }
  let notion: string[];
  try {
    notion = await section0Words(token);
  } catch (e) {
    console.log(`NOTION UNREADABLE: ${e instanceof Error ? e.message : String(e)} — the drift check could not run — check the token and the page share (I-8)`);
    Deno.exit(2);
  }
  const repoWords = normalize(quickstartBody(await Deno.readTextFile(QUICKSTART)));
  // The Notion heading line ("0. Quickstart — read this…") is not in the repo file; drop it before comparing.
  const headingWords = normalize("0. Quickstart — read this, you're ~90% correct");
  const notionBody = notion.slice(headingWords.length);
  const d = firstDrift(notionBody, repoWords);
  if (d) {
    console.log(`DRIFT: Notion §0 and scripts/rules-quickstart.md differ at word ${d.at} — the hand mirror lagged — copy Notion §0 into the quickstart and run deno task sync-rules (I-8)\n  notion: …${d.notion}…\n  repo:   …${d.repo}…`);
    Deno.exit(1);
  }
  console.log(`in sync: ${repoWords.length} words`);
}
