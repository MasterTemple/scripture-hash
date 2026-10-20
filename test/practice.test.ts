import { beforeAll, describe, expect, it } from "vitest";
import { loadTopos } from "@/bible/topos";
import { pickNext } from "@/practice/queue";
import { progress, words } from "@/practice/recite";
import { grade, partsToAsk } from "@/practice/reference";
import { verseKey } from "@/bible/types";

beforeAll(loadTopos);
const all = { book: true, chapter: true, verse: true };
const john316 = { bookId: 43, chapter: 3, verse: 16 };

describe("grade", () => {
  it("accepts abbreviations", () => {
    const g = grade(john316, { book: "jn", chapter: "3", verse: "16" }, all);
    expect(g.correct).toBe(true);
    expect(g.answer).toBe("John 3:16");
  });
  it("gives partial credit", () => {
    const g = grade(john316, { book: "John", chapter: "3", verse: "17" }, all);
    expect([g.correct, g.verse, g.score]).toEqual([false, "wrong", 2 / 3]);
  });
  it("skips parts not asked and accepts combined verses", () => {
    const g = grade(john316, { book: "", chapter: "", verse: "17" }, { book: false, chapter: false, verse: true }, [16, 17]);
    expect([g.correct, g.book]).toEqual([true, "given"]);
  });
});

describe("recite", () => {
  const verse = words("Jesus wept—and “God’s” love — remains.");
  it("splits words", () => {
    expect(verse.map((w) => w.bare)).toEqual(["jesus", "wept", "and", "gods", "love", "", "remains"]);
  });
  it("reads first letters", () => {
    const p = progress(verse, "jwaGl", "letters", new Set());
    expect(p.states.slice(0, 6)).toEqual(["correct", "correct", "correct", "correct", "correct", "correct"]);
    expect(p.states[6]).toBe("current");
    expect(progress(verse, "jwaglr", "letters", new Set()).complete).toBe(true);
    expect(progress(verse, "jx", "letters", new Set()).states[1]).toBe("wrong");
  });
  it("reads words", () => {
    const p = progress(verse, "Jesus wept and gods lov", "words", new Set());
    expect(p.done).toBe(4);
    expect(p.partial).toBe("lov");
    const done = progress(verse, "jesus wept and God's love remains", "words", new Set());
    expect([done.complete, done.score]).toEqual([true, 1]);
  });
  it("passes over revealed words", () => {
    const p = progress(verse, "jag", "letters", new Set([1]));
    expect(p.states.slice(0, 4)).toEqual(["correct", "revealed", "correct", "correct"]);
  });
});

describe("pickNext", () => {
  const pool = [1, 2, 3, 4].map((verse) => ({ bookId: 43, chapter: 3, verse }));
  it("asks each verse once per round when shuffling", () => {
    const asked = new Set<string>();
    let current = null;
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      current = pickNext(pool, current, "shuffle", asked, {});
      seen.add(verseKey(current!));
    }
    expect(seen.size).toBe(4);
  });
  it("goes in order", () => {
    expect(pickNext(pool, pool[3]!, "sequential", new Set(), {})).toEqual(pool[0]);
  });
  it("favors weak verses", () => {
    const stats = Object.fromEntries(pool.slice(1).map((v) => [verseKey(v), { attempts: 10, correct: 10, streak: 10, last: 0 }]));
    let weak = 0;
    for (let i = 0; i < 200; i++) if (pickNext(pool, null, "weakest", new Set(), stats)!.verse === 1) weak++;
    expect(weak).toBeGreaterThan(120);
  });
});

describe("partsToAsk", () => {
  const v = (bookId: number, chapter: number, verse: number) => ({ bookId, chapter, verse });
  it("fills in a book every verse shares", () => {
    const r = partsToAsk(all, [v(45, 8, 28), v(45, 9, 1)]);
    expect(r.ask).toEqual({ book: false, chapter: true, verse: true });
    expect(r.obvious).toEqual({ book: true, chapter: false });
  });
  it("fills in a chapter every verse shares", () => {
    expect(partsToAsk(all, [v(45, 8, 28), v(45, 8, 29)]).ask).toEqual({ book: false, chapter: false, verse: true });
  });
  it("asks everything across books", () => {
    expect(partsToAsk(all, [v(45, 8, 28), v(43, 3, 16)]).ask).toEqual(all);
  });
  it("still asks something", () => {
    const r = partsToAsk({ book: true, chapter: true, verse: false }, [v(45, 8, 28), v(45, 8, 29)]);
    expect(r.ask).toEqual({ book: false, chapter: false, verse: true });
  });
});
