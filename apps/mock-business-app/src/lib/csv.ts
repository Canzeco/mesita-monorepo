// EXPORT, AND THE TABLE'S OWN COLUMNS ARE WHAT WRITE IT.
//
// Pato 2026-09-16: *"add a button to export data to excel or something like
// that. it must be really easy, in fact."* Easy is the requirement, so this is
// a Blob and a click — no backend, no library, nothing this app is not allowed
// to have.
//
// THE COLUMNS ARE THE SINGLE SOURCE. A `text` beside each column's `cell`
// means the file and the screen cannot disagree about what a table holds; a
// second list of fields written beside the columns is the one kind of
// duplication that drifts, and it drifts silently because nobody opens the
// download twice.
//
// THREE THINGS THAT DECIDE WHETHER EXCEL CAN OPEN IT AT ALL:
//
//   1. THE BOM. Without the leading U+FEFF, Excel reads a UTF-8 file as the
//      system code page and "Fermín Rico" arrives as "FermÃ­n Rico". One
//      character is the difference between a file that opens and a file the
//      operator emails back asking what happened.
//   2. CRLF. Excel is the target and it is the one reader that still cares.
//   3. MONEY AS A NUMBER. `$1,234.56` lands in a spreadsheet as TEXT — the
//      currency symbol and the thousands comma see to that — so the column the
//      operator opened the file to sum is the one column they cannot sum.
//      Amounts export as plain decimals and the header says what they are.

export type CsvColumn<T> = {
  head: string;
  /** The cell as a spreadsheet sees it. Empty string for "nothing here" — a
   *  dash is a drawing, and `—` in a numeric column breaks the whole column. */
  text: (row: T) => string;
};

/** RFC 4180 quoting: wrap when the value carries a comma, a quote or a break,
 *  and double every quote inside. A guest note with a comma in it is not an
 *  edge case, it is Tuesday. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => cell(c.head)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.text(row))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Hands the browser a file. The object URL is revoked on the next frame
 *  rather than immediately — Safari has not always started the download by the
 *  time `click()` returns, and a revoked URL cancels it with no error. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/** A filename nobody has to rename. Place, what it holds, and the date it was
 *  taken — three downloads in a week sort themselves in the Downloads folder,
 *  which a bare `activity.csv` does not. */
export function csvFilename(parts: string[]): string {
  return (
    parts
      .map((p) =>
        p
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      )
      .filter(Boolean)
      .join("-") + ".csv"
  );
}

/** Sortable local time, and `sv-SE` is the shortest honest way to get it:
 *  "2026-09-16 18:20". The screen's own `dayTime` prints "Sep 16, 6:20 PM",
 *  which Excel reads as text in half the world's locales and sorts
 *  alphabetically in the other half. Same instant, same zone, different
 *  reader. */
const CSV_WHEN = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function csvWhen(iso: string): string {
  return CSV_WHEN.format(new Date(iso));
}

export function csvDay(date: Date): string {
  return CSV_WHEN.format(date).slice(0, 10);
}

/** Centavos as a plain decimal. No symbol, no separator, two places — the
 *  three things a spreadsheet wants and a reader does not. */
export function csvMoney(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}
