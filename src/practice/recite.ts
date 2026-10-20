import type { ReciteStyle } from "@/state/store";

/** A word of the verse as shown, and what's compared when it's typed */
export interface Word {
  /** As printed, with its punctuation */
  text: string;
  /** Lowercased letters and digits alone ("Father's" → "fathers"); empty for a dash or a number sign */
  bare: string;
}

/** Curly quotes, dashes, and the like, as a keyboard types them */
export const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―⸺⸻－]/g, "-");

const bareOf = (s: string) => normalize(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function words(verse: string): Word[] {
  return verse
    .split(/\s+|(?<=[—–])(?=\p{L})/u)
    .filter(Boolean)
    .map((text) => ({ text, bare: bareOf(text) }));
}

export type WordState = "correct" | "wrong" | "revealed" | "current" | "hidden";

export interface Progress {
  states: WordState[];
  /** What was typed for each word, so a wrong one can show it */
  typed: string[];
  /** How far the current word is typed (words mode) */
  partial: string;
  /** Words done (typed or revealed) */
  done: number;
  complete: boolean;
  /** Share of words gotten right (revealed ones count as wrong) */
  score: number;
}

/**
 * Reads what was typed against the verse.
 * - letters: each letter or digit typed is the next word's first; spaces and punctuation are ignored
 * - words: words separated by spaces, compared without case or punctuation
 * `revealed` holds the indices of words given as hints.
 */
export function progress(verse: Word[], input: string, style: ReciteStyle, revealed: Set<number>): Progress {
  const states: WordState[] = verse.map(() => "hidden");
  const typed: string[] = verse.map(() => "");
  let i = 0;
  // Words with nothing to type (a lone dash) and hints are passed over
  const skip = () => {
    while (i < verse.length && (verse[i]!.bare === "" || revealed.has(i))) {
      states[i] = verse[i]!.bare === "" ? "correct" : "revealed";
      i++;
    }
  };
  skip();
  let partial = "";

  if (style === "letters") {
    for (const ch of bareOf(input)) {
      if (i >= verse.length) break;
      typed[i] = ch;
      states[i] = verse[i]!.bare[0] === ch ? "correct" : "wrong";
      i++;
      skip();
    }
  } else {
    const parts = normalize(input).split(/\s+/);
    const finished = parts.slice(0, -1).filter(Boolean);
    partial = parts[parts.length - 1] ?? "";
    for (const part of finished) {
      if (i >= verse.length) break;
      typed[i] = part;
      states[i] = bareOf(part) === verse[i]!.bare ? "correct" : "wrong";
      i++;
      skip();
    }
    // The last word counts as soon as it's typed fully, with no space after it
    if (i === verse.length - 1 && partial && bareOf(partial) === verse[i]!.bare) {
      typed[i] = partial;
      states[i] = "correct";
      i++;
      partial = "";
    }
  }

  if (i < verse.length) states[i] = "current";
  const right = states.filter((s) => s === "correct").length;
  const counted = verse.filter((w) => w.bare !== "").length || 1;
  return {
    states,
    typed,
    partial: i < verse.length ? partial : "",
    done: i,
    complete: i >= verse.length,
    score: (right - (verse.length - counted)) / counted,
  };
}

/** A run of the word being typed, as it's drawn */
export interface TypedRun {
  text: string;
  /** Whether it matches the word so far (punctuation and case don't matter) */
  ok: boolean;
}

const isWordChar = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
const fold = (ch: string) => normalize(ch).toLowerCase();

/**
 * What's typed of a word, drawn as the word is printed: each letter takes the word's own
 * case ("gods" → "God's"), and its punctuation comes along. Letters that don't match are kept
 * as typed and marked, so typos can show right away.
 */
export function typedRuns(word: string, partial: string): TypedRun[] {
  const target = [...word];
  const runs: TypedRun[] = [];
  const push = (text: string, ok: boolean) => {
    const last = runs[runs.length - 1];
    if (last && last.ok === ok) last.text += text;
    else runs.push({ text, ok });
  };
  let i = 0;
  for (const ch of partial) {
    if (!isWordChar(ch)) {
      // Punctuation is optional: take it where the word has it, else pass over it
      if (i < target.length && fold(target[i]!) === fold(ch)) push(target[i++]!, true);
      continue;
    }
    // The word's punctuation before this letter comes along
    let lead = "";
    while (i < target.length && !isWordChar(target[i]!)) lead += target[i++];
    if (i < target.length && fold(target[i]!) === fold(ch)) {
      push(lead + target[i++]!, true);
    } else {
      if (lead) push(lead, true);
      push(ch, false);
      if (i < target.length) i++;
    }
  }
  // Punctuation that ends the word ("Lord,") shows once its letters are all typed
  if (runs.length && runs.every((r) => r.ok) && target.slice(i).every((c) => !isWordChar(c))) push(target.slice(i).join(""), true);
  return runs;
}

/** A word split into its runs of letters and of punctuation: "“God’s" → “ God ’ s */
export const wordParts = (word: string) =>
  word
    .split(/([\p{L}\p{N}]+)/u)
    .filter(Boolean)
    .map((text) => ({ text, letters: /[\p{L}\p{N}]/u.test(text) }));
