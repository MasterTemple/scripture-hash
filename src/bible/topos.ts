import { BookStyle, initialized, OffsetUnit, ToposOptions, type BookInfo, type Topos } from "topos-bible";
import { spanLabel, type SelectedPassage, type VerseRef, type VerseText } from "./types";

let instance: Topos | null = null;
let books: BookInfo[] = [];

/** Loads topos's WebAssembly; call once before anything else here */
export async function loadTopos() {
  if (instance) return;
  await initialized;
  // A selection is meant to be references, so a book named alone ("Jude") is the whole book
  instance = ToposOptions.create().booksAlone(true).build();
  books = instance.books();
}

function topos(): Topos {
  if (!instance) throw new Error("topos is not loaded yet");
  return instance;
}

export function bookById(id: number): BookInfo {
  const book = books[id - 1];
  if (!book) throw new Error(`no book ${id}`);
  return book;
}

/** A book's id from its name or abbreviation ("rom", "1 Pet"), ignoring case */
export const findBook = (name: string): number | null => (name.trim() ? topos().findBook(name.trim()) : null);

/** Books for what's typed, best first: the one it names, then names starting with it, then later words */
export const suggestBooks = (typed: string, limit = 6): BookInfo[] => topos().suggestBooks(typed, limit);

/** How many verses a chapter has, or null when the book has no such chapter */
export const verseCount = (bookId: number, chapter: number): number | null => topos().verseCount(bookId, chapter);

export function formatRef(v: VerseRef, style: "name" | "abbreviation" = "name"): string {
  const book = bookById(v.bookId);
  return `${style === "name" ? book.name : book.abbreviation} ${v.chapter}:${v.verse}`;
}

/** A verse's reference as the translation prints it: "John 3:4–5" when verses 4 and 5 are printed together */
export function formatPrinted(v: VerseRef, printed?: VerseText): string {
  const span = printed && spanLabel(printed);
  if (!span) return formatRef(v);
  const book = bookById(v.bookId).name;
  return printed.chapters ? `${book} ${span}` : `${book} ${v.chapter}:${span}`;
}

/** Every passage written in the text (references, chapters, and whole books), in order */
export function parseSelection(text: string): SelectedPassage[] {
  const t = topos();
  return t.search(text, OffsetUnit.Utf16).map((m) => ({
    reference: m.passage.reference,
    bookId: m.passage.bookId,
    verses: t.verses(m.passage).map(({ chapter, verse }) => ({ bookId: m.passage.bookId, chapter, verse })),
  }));
}

/** The verses of every passage, each once, in the order first written */
export function uniqueVerses(passages: SelectedPassage[]): VerseRef[] {
  const seen = new Set<string>();
  const out: VerseRef[] = [];
  for (const p of passages) {
    for (const v of p.verses) {
      const key = `${v.bookId}.${v.chapter}.${v.verse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/** Reference completions for the selection editor, replacing `start`–`end` with `text` */
export function completeReference(text: string, cursor: number, limit = 8) {
  return topos().complete(text, cursor, OffsetUnit.Utf16, BookStyle.Name, limit);
}
