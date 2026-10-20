import { BookStyle, LogoxideBook, type Logoxide, type Topos } from "logoxide";
import type { BookText, VerseText } from "./types";

export type Markup = "usx" | "usfm" | "osis";

const options = { notes: false, headings: false, classPrefix: "" };

/** Cleans what logoxide's plain text keeps that a reader doesn't type: paragraph marks, extra spaces */
const clean = (text: string) =>
  text
    .replace(/[¶§]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Every verse of a USX, USFM, or OSIS book; `null` if it isn't one logoxide can read */
export function readBook(lx: Logoxide, topos: Topos, markup: Markup, source: string): BookText | null {
  const usx = markup === "usfm" ? lx.usfmToUsx(source) : source;
  const book = LogoxideBook.parse(topos, markup === "osis" ? "osis" : "usx", usx);
  if (!book) return null;
  try {
    const bookId = book.bookId();
    const osis = bookId ? topos.books()[bookId - 1]?.osis : undefined;
    if (!bookId || !osis) return null;
    const verses: Record<string, VerseText> = {};
    for (const v of book.verses()) {
      // A verse printed in parts ("20a", "20b") is read whole once, from its first part
      if (v.part > 0 && verses[`${v.chapter}:${v.verse}`]) continue;
      // Verses printed together ("4-5", or across chapters "1:31-2:1") share their text
      const lastChapter = Math.max(v.lastChapter, v.chapter);
      const across = lastChapter > v.chapter;
      const last = across ? v.last : Math.max(v.last, v.verse);
      const together = across || last > v.verse;
      const ref = together ? `${osis}.${v.chapter}.${v.verse}-${osis}.${lastChapter}.${last}` : `${osis}.${v.chapter}.${v.verse}`;
      const passage = topos.parse(ref, BookStyle.Name);
      if (!passage) continue;
      const text = clean(book.text(passage, options).join(" "));
      if (!text) continue;
      const entry: VerseText = !together ? { text } : across ? { text, span: [v.verse, last], chapters: [v.chapter, lastChapter] } : { text, span: [v.verse, last] };
      // Across chapters, the verses between are topos's (the default versification's), which
      // may not count to the translation's own first or last verse
      const covered = across
        ? topos.verses(passage)
        : Array.from({ length: last - v.verse + 1 }, (_, i) => ({ chapter: v.chapter, verse: v.verse + i }));
      for (const end of [{ chapter: v.chapter, verse: v.verse }, { chapter: lastChapter, verse: last }]) {
        if (!covered.some((c) => c.chapter === end.chapter && c.verse === end.verse)) covered.push(end);
      }
      for (const c of covered) verses[`${c.chapter}:${c.verse}`] = entry;
    }
    return { bookId, verses };
  } finally {
    book.dispose();
  }
}

/** Which markup a file is in, by its name and first lines */
export function markupOf(name: string, text: string): Markup | null {
  const head = text.slice(0, 2000);
  if (/<osis[\s>]/.test(head)) return "osis";
  if (/<usx[\s>]/.test(head)) return "usx";
  if (/^﻿?\s*\\id\s/.test(head)) return "usfm";
  if (/\.(usfm|sfm)$/i.test(name)) return "usfm";
  return null;
}

const DIV = /<div\b[^>]*?(\/?)>|<\/div\s*>/g;
const BOOK_DIV = /\btype\s*=\s*["']book["']/;

/**
 * An OSIS file's books, each as a file of its own: logoxide reads one book a file, and would
 * merge a whole Bible's into its first. A file of one book is returned as it is; `null` when
 * its books are milestones (`<div type="book" sID="…"/>`), which this doesn't split.
 */
export function splitOsis(source: string): string[] | null {
  const books: string[] = [];
  let depth = 0;
  let start = -1;
  let bookDepth = -1;
  for (const m of source.matchAll(DIV)) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === bookDepth) {
        books.push(source.slice(start, m.index + m[0].length));
        start = bookDepth = -1;
      }
    } else if (m[1]) {
      if (start < 0 && BOOK_DIV.test(m[0])) return null;
    } else {
      if (start < 0 && BOOK_DIV.test(m[0])) {
        start = m.index;
        bookDepth = depth;
      }
      depth++;
    }
  }
  const osisText = /<osisText\b[^>]*>/.exec(source);
  if (books.length < 2 || !osisText) return [source];
  // Each book keeps the work's opening and header (which name its versification)
  const head = source.slice(0, osisText.index + osisText[0].length) + (/<header\b[\s\S]*?<\/header>/.exec(source)?.[0] ?? "");
  return books.map((book) => `${head}${book}</osisText></osis>`);
}

const SCRIPTURE = /\.(usfm|sfm|usx|xml|txt)$/i;

/**
 * Reads uploaded files, keeping the books it can read. A zip (a whole Bible, as eBible.org and
 * Paratext export them) is opened, and its books read whatever folders they're in.
 * `onProgress` hears how many files are read of how many.
 */
export function readFiles(
  lx: Logoxide,
  topos: Topos,
  files: { name: string; bytes: Uint8Array }[],
  onProgress?: (done: number, total: number) => void,
) {
  const queue: { name: string; bytes: Uint8Array; inZip: boolean }[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      for (const inner of lx.unzip(file.bytes)) queue.push({ name: inner.path, bytes: inner.bytes, inZip: true });
    } else {
      queue.push({ ...file, inZip: false });
    }
  }
  const books: BookText[] = [];
  const skipped: string[] = [];
  const decoder = new TextDecoder();
  const total = queue.length;
  for (const [i, file] of queue.entries()) {
    onProgress?.(i, total);
    // A zip's other files (copyright pages, stylesheets, signatures) aren't worth mentioning
    if (file.inZip && !SCRIPTURE.test(file.name)) continue;
    const text = decoder.decode(file.bytes);
    const markup = markupOf(file.name, text);
    if (!markup) {
      if (!file.inZip) skipped.push(file.name);
      continue;
    }
    try {
      const sources = markup === "osis" ? splitOsis(text) : [text];
      let found = false;
      for (const source of sources ?? []) {
        const book = readBook(lx, topos, markup, source);
        if (book && Object.keys(book.verses).length) {
          books.push(book);
          found = true;
        }
      }
      if (!found && !file.inZip) skipped.push(file.name); // a zip's front matter and glossary aren't books
    } catch {
      skipped.push(file.name);
    }
  }
  onProgress?.(total, total);
  return { books, skipped };
}
