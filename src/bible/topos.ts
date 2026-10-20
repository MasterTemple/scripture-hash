import { BookStyle, initialized, OffsetUnit, Topos, type BookInfo } from "topos-bible";
import { spanLabel, type SelectedPassage, type VerseRef, type VerseText } from "./types";

let instance: Topos | null = null;
let books: BookInfo[] = [];

/** Loads topos's WebAssembly; call once before anything else here */
export async function loadTopos() {
  if (instance) return;
  await initialized;
  instance = Topos.new();
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

/** Books whose name or abbreviation starts with what's typed, best first */
export function suggestBooks(typed: string, limit = 6): BookInfo[] {
  const q = typed.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const exact = findBook(q);
  const scored: [BookInfo, number][] = [];
  for (const book of books) {
    const names = [book.name, book.abbreviation, book.osis].map((n) => n.toLowerCase());
    let score = -1;
    if (book.id === exact) score = 0;
    else if (names.some((n) => n.startsWith(q))) score = 1;
    else if (names.some((n) => n.replace(/\s/g, "").startsWith(q.replace(/\s/g, "")))) score = 2;
    else if (book.name.toLowerCase().includes(q)) score = 3;
    if (score >= 0) scored.push([book, score]);
  }
  // Names merely containing what's typed only when nothing starts with it
  const best = scored.some(([, s]) => s <= 2) ? scored.filter(([, s]) => s <= 2) : scored;
  return best
    .sort((a, b) => a[1] - b[1] || a[0].id - b[0].id)
    .slice(0, limit)
    .map(([book]) => book);
}

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

/** Book names alone ("Romans", "Jude"), which topos leaves to us, as whole books */
function wholeBooks(text: string, covered: [number, number][]): { at: number; bookId: number }[] {
  const found: { at: number; bookId: number }[] = [];
  const chunk = /[^,;\n]+/g;
  for (const m of text.matchAll(chunk)) {
    const start = m.index;
    const end = start + m[0].length;
    if (covered.some(([s, e]) => s < end && e > start)) continue;
    for (const piece of m[0].split(/\band\b|&/i)) {
      const name = piece.trim().replace(/\.$/, "");
      if (!name || /\d+\s*[:.]/.test(name)) continue;
      const bookId = findBook(name);
      if (bookId) found.push({ at: start + m[0].indexOf(piece), bookId });
    }
  }
  return found;
}

/** Every passage written in the text (references, chapters, and whole books), in order */
export function parseSelection(text: string): SelectedPassage[] {
  const t = topos();
  const matches = t.search(text, OffsetUnit.Utf16);
  const found: { at: number; passage: SelectedPassage }[] = matches.map((m) => ({
    at: m.start,
    passage: {
      reference: m.passage.reference,
      bookId: m.passage.bookId,
      verses: t.verses(m.passage).map(({ chapter, verse }) => ({ bookId: m.passage.bookId, chapter, verse })),
    },
  }));
  for (const { at, bookId } of wholeBooks(text, matches.map((m) => [m.start, m.end]))) {
    const book = bookById(bookId);
    // OSIS, where a single-chapter book's number is its chapter
    const passage = t.parse(book.chapters > 1 ? `${book.osis}.1-${book.osis}.${book.chapters}` : `${book.osis}.1`, BookStyle.Name);
    if (!passage) continue;
    found.push({
      at,
      passage: {
        reference: book.name,
        bookId,
        verses: t.verses(passage).map(({ chapter, verse }) => ({ bookId, chapter, verse })),
      },
    });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.passage);
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
