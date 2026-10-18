// Docs › Vocabulary ratchet — banned tokens in human-facing strings and cards.
// Run via deno task test:rules (vocabulary-ratchet.test.ts).

import { extname, join, relative } from "@std/path";

export type Violation = { file: string; line: number; token: string; excerpt: string };

const DELETED_HOSTS = [
  "business.mesita.ai",
  "check.mesita.ai",
  "validate.mesita.ai",
] as const;

const DELETED_SLUGS = [
  "web-business",
  "web-validate",
  "mobile-business",
] as const;

const UI_ROOTS = [
  "apps/web-admin/src",
  "apps/web-consumer/src",
  "apps/web-landing/src",
  "packages/place-profile/src",
] as const;

const CARD_PATHS = [
  "apps/web-admin/CLAUDE.md",
  "apps/web-consumer/CLAUDE.md",
  "apps/web-landing/CLAUDE.md",
  "supabase/CLAUDE.md",
] as const;

const EF_ROOT = "supabase/supabase/functions";

const SKIP_FILE = /\.(test|spec)\.(ts|tsx)$/;
const RATCHET_SELF = /vocabulary-ratchet/;

/** Strip line and block comments without touching string contents (approximate). */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n - 1 && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        if (source[i] === "\\") {
          out += source[i++];
          if (i < n) out += source[i++];
          continue;
        }
        out += source[i];
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Quoted string literals and plain JSX text (no `{expr}`). */
export function extractHumanStrings(source: string): { text: string; index: number }[] {
  const stripped = stripComments(source);
  const hits: { text: string; index: number }[] = [];
  for (const re of [
    /"(?:\\.|[^"\\])*"/g,
    /'(?:\\.|[^'\\])*'/g,
  ]) {
    for (const m of stripped.matchAll(re)) {
      const text = m[0].slice(1, -1);
      if (text.includes("${")) continue;
      if (text.startsWith("@/") || text.startsWith("./") || text.startsWith("../")) {
        continue;
      }
      if (text.length > 0) hits.push({ text, index: m.index ?? 0 });
    }
  }
  for (const m of stripped.matchAll(/>([^<{]+)</g)) {
    const text = m[1].trim();
    if (text.length > 0 && /[A-Za-z]/.test(text)) {
      hits.push({ text, index: m.index ?? 0 });
    }
  }
  return hits;
}

function isCarvedOut(token: string, text: string, file: string): boolean {
  const lower = text.toLowerCase();
  switch (token) {
    case "unit":
      return /\bunit test\b/i.test(text) || /\b100-unit\b/i.test(text) ||
        /\bquota unit\b/i.test(text);
    case "user":
      return /role:\s*["']user["']/.test(text) ||
        /\blucide-react/.test(file);
    case "business":
      return /\bbusiness_state\b/.test(text) ||
        /\bbusinessStatus\b/.test(text) ||
        /\bbusiness_plans\b/.test(text);
    case "status":
      return /\bResponse\.status\b/.test(text) ||
        /\bhttpStatus\b/.test(text) ||
        /\bbusinessStatus\b/.test(text);
    case "Crenup":
      return /\bCrenupPage\b/.test(text) ||
        /\bCRENUP_/.test(text);
    case "Active":
      return /\bOnly active places\b/.test(text);
    case "Listed":
      return false;
    case "Intake":
    case "Intaker":
      return /\bintake\b/.test(lower) && !/\bIntaker\b/.test(text);
    default:
      return false;
  }
}

function checkLiteral(
  file: string,
  source: string,
  text: string,
  index: number,
  token: string,
  re: RegExp,
): Violation | null {
  if (!re.test(text)) return null;
  if (isCarvedOut(token, text, file)) return null;
  const line = lineNumberAt(source, index);
  const excerpt = text.length > 80 ? `${text.slice(0, 77)}...` : text;
  return { file, line, token, excerpt };
}

function isCrenupIdentifierPath(relPath: string): boolean {
  return /crenup/i.test(relPath) ||
    relPath.includes("enricher-config/") ||
    relPath.includes("filters-config/catalog.ts");
}

function scanUiFile(repoRoot: string, relPath: string): Violation[] {
  if (SKIP_FILE.test(relPath) || RATCHET_SELF.test(relPath)) return [];
  const abs = join(repoRoot, relPath);
  let source: string;
  try {
    source = Deno.readTextFileSync(abs);
  } catch {
    return [];
  }
  const violations: Violation[] = [];
  const strings = extractHumanStrings(source);

  const pushIf = (token: string, re: RegExp, text: string, index: number) => {
    const v = checkLiteral(relPath, source, text, index, token, re);
    if (v) violations.push(v);
  };

  for (const { text, index } of strings) {
    for (const host of DELETED_HOSTS) {
      if (text.includes(host)) {
        violations.push({
          file: relPath,
          line: lineNumberAt(source, index),
          token: host,
          excerpt: text.slice(0, 80),
        });
      }
    }
    for (const slug of DELETED_SLUGS) {
      if (text.includes(slug)) {
        violations.push({
          file: relPath,
          line: lineNumberAt(source, index),
          token: slug,
          excerpt: text.slice(0, 80),
        });
      }
    }
    pushIf("venue", /\bvenue\b/i, text, index);
    pushIf("Ojo", /\bOjo\b/, text, index);
    pushIf("Business plans", /Business plans/i, text, index);
    if (!isCrenupIdentifierPath(relPath)) {
      pushIf("Crenup", /\bCrenup\b/, text, index);
    }
    pushIf("business console", /business console/i, text, index);
    pushIf("organization", /\borganization(s)?\b/i, text, index);
    pushIf("guest account", /guest account/i, text, index);
    pushIf("member code", /member code/i, text, index);
    pushIf("ambiance", /\bambiance\b/i, text, index);
    pushIf("Agent X", /Agent X/i, text, index);
    pushIf("Agent Y", /Agent Y/i, text, index);
    pushIf("Intaker", /\bIntaker\b/, text, index);
    pushIf("Intake", /\bIntake\b/, text, index);
    if (/\bmanager\b/i.test(text) && !isCarvedOut("manager", text, relPath)) {
      pushIf("manager", /\bmanager\b/i, text, index);
    }
  }
  return violations;
}

async function walkTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...(await walkTsFiles(path)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

export function scanPackageCards(repoRoot: string): Violation[] {
  const violations: Violation[] = [];
  for (const rel of CARD_PATHS) {
    const abs = join(repoRoot, rel);
    let text: string;
    try {
      text = Deno.readTextFileSync(abs);
    } catch {
      continue;
    }
    if (/venue.*\bplace\s*\/\s*business\b/i.test(text) ||
      /use\s+["']place["']\s*\/\s*["']business["']/i.test(text)) {
      violations.push({
        file: rel,
        line: 1,
        token: "venue→business",
        excerpt: "CLAUDE.md teaches venue → place / business",
      });
    }
  }
  return violations;
}

export async function scanVocabulary(repoRoot: string): Promise<Violation[]> {
  const violations: Violation[] = [...scanPackageCards(repoRoot)];
  for (const root of UI_ROOTS) {
    const absRoot = join(repoRoot, root);
    try {
      const files = await walkTsFiles(absRoot);
      for (const abs of files) {
        const rel = relative(repoRoot, abs);
        violations.push(...scanUiFile(repoRoot, rel));
      }
    } catch {
      // missing package root in partial checkouts
    }
  }
  return violations;
}
