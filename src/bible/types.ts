/** One verse, by topos's book id (1 Genesis … 66 Revelation) */
export interface VerseRef {
  bookId: number;
  chapter: number;
  verse: number;
}

/** A passage written in the selection, with the verses it covers */
export interface SelectedPassage {
  /** As topos writes it, e.g. "Romans 8:28-30" */
  reference: string;
  bookId: number;
  verses: VerseRef[];
}

/** A verse's text in one translation; verses printed together share their text */
export interface VerseText {
  text: string;
  /** The first and last verse of a combined verse ("4-5"), when it is one */
  span?: [first: number, last: number];
}

/** Every verse of one book in one translation, keyed by `chapter:verse` */
export interface BookText {
  bookId: number;
  verses: Record<string, VerseText>;
}

export type TranslationSource =
  | { kind: "fetch"; id: string }
  | { kind: "upload" };

export interface Translation {
  /** Stable id used for storage, e.g. "fetch:eng_bsb" or "upload:my-bible" */
  id: string;
  name: string;
  abbreviation: string;
  source: TranslationSource;
  language?: string;
  attribution?: string;
  attributionUrl?: string;
  /** For uploads, the books that were imported */
  books?: number[];
}

export const verseKey = (v: VerseRef) => `${v.bookId}.${v.chapter}.${v.verse}`;

export function parseVerseKey(key: string): VerseRef {
  const [bookId, chapter, verse] = key.split(".").map(Number) as [number, number, number];
  return { bookId, chapter, verse };
}

export const sameVerse = (a: VerseRef, b: VerseRef) =>
  a.bookId === b.bookId && a.chapter === b.chapter && a.verse === b.verse;
