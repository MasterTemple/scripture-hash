import { bookById, findBook } from "@/bible/topos";
import type { VerseRef } from "@/bible/types";
import type { Settings } from "@/state/store";

export interface Guess {
  book: string;
  chapter: string;
  verse: string;
}

export type PartResult = "correct" | "wrong" | "given";

export interface Grade {
  book: PartResult;
  chapter: PartResult;
  verse: PartResult;
  correct: boolean;
  score: number;
  /** The guess as a reference, for the history */
  answer: string;
}

/**
 * Grades a guess at a verse's reference. Parts not asked for are `given`. `span` is the
 * verses printed together with this one, any of which is right, and `chapters` the chapters
 * they start and end in when they cross one.
 */
export function grade(target: VerseRef, guess: Guess, ask: Settings["ask"], span?: [number, number], chapters?: [number, number]): Grade {
  const bookId = ask.book ? findBook(guess.book) : target.bookId;
  const chapter = ask.chapter ? Number.parseInt(guess.chapter, 10) : target.chapter;
  const verse = ask.verse ? Number.parseInt(guess.verse, 10) : target.verse;
  const [first, last] = span ?? [target.verse, target.verse];
  const [firstChapter, lastChapter] = chapters ?? [target.chapter, target.chapter];
  const chapterRight = chapter >= firstChapter && chapter <= lastChapter;
  // The verse is judged in the chapter guessed when that's one the span is in
  const at = (c: number, v: number) => c * 1000 + v;
  const place = at(chapterRight ? chapter : target.chapter, verse);

  const book: PartResult = !ask.book ? "given" : bookId === target.bookId ? "correct" : "wrong";
  const ch: PartResult = !ask.chapter ? "given" : chapterRight ? "correct" : "wrong";
  const vs: PartResult = !ask.verse ? "given" : place >= at(firstChapter, first) && place <= at(lastChapter, last) ? "correct" : "wrong";

  const asked = [book, ch, vs].filter((p) => p !== "given");
  const right = asked.filter((p) => p === "correct").length;
  const bookName = bookId ? bookById(bookId).name : guess.book.trim() || "?";
  return {
    book,
    chapter: ch,
    verse: vs,
    correct: right === asked.length,
    score: asked.length ? right / asked.length : 1,
    answer: `${bookName} ${Number.isNaN(chapter) ? "?" : chapter}:${Number.isNaN(verse) ? "?" : verse}`,
  };
}

export interface Asked {
  ask: Settings["ask"];
  /** Parts left out because every verse being practiced shares them */
  obvious: { book: boolean; chapter: boolean };
}

/**
 * What to ask for, given the verses being practiced: when they're all in one book (or one
 * chapter), naming it tells nothing, so it's filled in. The verse is asked when nothing else is.
 */
export function partsToAsk(ask: Settings["ask"], pool: VerseRef[]): Asked {
  const first = pool[0];
  const oneBook = !!first && pool.every((v) => v.bookId === first.bookId);
  const oneChapter = oneBook && pool.every((v) => v.chapter === first!.chapter);
  const obvious = { book: oneBook && ask.book, chapter: oneChapter && ask.chapter };
  const asked = { book: ask.book && !oneBook, chapter: ask.chapter && !oneChapter, verse: ask.verse };
  if (!asked.book && !asked.chapter && !asked.verse) asked.verse = true;
  return { ask: asked, obvious };
}

/**
 * Whether a chapter or verse number being typed is finished: it's right, or it's a number
 * there is (up to `last`) that no digit could follow, as 4 in a book of 5 chapters is
 */
export function numberDone(typed: string, last: number | null, right: boolean): boolean {
  if (right) return true;
  const n = Number.parseInt(typed, 10);
  return last !== null && n >= 1 && n <= last && n * 10 > last;
}
