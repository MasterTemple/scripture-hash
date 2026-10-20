import { beforeAll, describe, expect, it } from "vitest";
import { loadTopos, parseSelection, suggestBooks, uniqueVerses } from "@/bible/topos";

beforeAll(loadTopos);

describe("parseSelection", () => {
  it("reads references, chapters, and lists", () => {
    const passages = parseSelection("John 3:16\nRom 8:28-30; Ps 23, Jude 3");
    expect(passages.map((p) => p.reference)).toEqual(["John 3:16", "Romans 8:28-30", "Psalm 23", "Jude 1:3"]);
    expect(passages[1]!.verses).toHaveLength(3);
    expect(passages[2]!.verses).toHaveLength(6);
  });

  it("reads whole books", () => {
    const passages = parseSelection("Philemon\nJude, Titus\nJohn 1:1");
    expect(passages.map((p) => p.reference)).toEqual(["Philemon", "Jude", "Titus", "John 1:1"]);
    expect(passages[0]!.verses).toHaveLength(25);
    expect(passages[2]!.verses.at(-1)).toEqual({ bookId: 56, chapter: 3, verse: 15 });
  });

  it("keeps each verse once", () => {
    expect(uniqueVerses(parseSelection("John 3:16-17; John 3:16"))).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("suggests books", () => {
    expect(suggestBooks("rom")[0]!.name).toBe("Romans");
    expect(suggestBooks("1 pe")[0]!.name).toBe("1 Peter");
    expect(suggestBooks("phil").map((b) => b.name)).toContain("Philemon");
    // Unlike topos's completions, a whole name is still a book, and so is a number alone
    expect(suggestBooks("john").map((b) => b.name)).toEqual(["John"]);
    expect(suggestBooks("1").map((b) => b.name)).toContain("1 Corinthians");
    expect(suggestBooks("  1  john")[0]!.name).toBe("1 John");
  });
});
