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
      // Verses printed together ("4-5") share their text
      const last = v.lastChapter === v.chapter ? v.last : v.verse;
      const ref = last > v.verse ? `${osis}.${v.chapter}.${v.verse}-${osis}.${v.chapter}.${last}` : `${osis}.${v.chapter}.${v.verse}`;
      const passage = topos.parse(ref, BookStyle.Name);
      if (!passage) continue;
      const text = clean(book.text(passage, options).join(" "));
      if (!text) continue;
      for (let n = v.verse; n <= last; n++) {
        verses[`${v.chapter}:${n}`] = last > v.verse ? { text, span: [v.verse, last] } : { text };
      }
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
      const book = readBook(lx, topos, markup, text);
      if (book && Object.keys(book.verses).length) books.push(book);
      else if (!file.inZip) skipped.push(file.name); // a zip's front matter and glossary aren't books
    } catch {
      skipped.push(file.name);
    }
  }
  onProgress?.(total, total);
  return { books, skipped };
}
