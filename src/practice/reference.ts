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
 * verses printed together with this one, any of which is right.
 */
export function grade(target: VerseRef, guess: Guess, ask: Settings["ask"], span?: [number, number]): Grade {
  const bookId = ask.book ? findBook(guess.book) : target.bookId;
  const chapter = ask.chapter ? Number.parseInt(guess.chapter, 10) : target.chapter;
  const verse = ask.verse ? Number.parseInt(guess.verse, 10) : target.verse;
  const [first, last] = span ?? [target.verse, target.verse];

  const book: PartResult = !ask.book ? "given" : bookId === target.bookId ? "correct" : "wrong";
  const ch: PartResult = !ask.chapter ? "given" : chapter === target.chapter ? "correct" : "wrong";
  const vs: PartResult = !ask.verse ? "given" : verse >= first && verse <= last ? "correct" : "wrong";

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
