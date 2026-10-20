import { readFileSync } from "node:fs";
import { Logoxide, Topos } from "logoxide";
import { describe, expect, it } from "vitest";
import { markupOf, readBook, readFiles } from "@/bible/parse";

const lx = Logoxide.new();
const topos = Topos.new();
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("readBook", () => {
  it("reads USX", () => {
    const book = readBook(lx, topos, "usx", fixture("jhn_bsb.usx"))!;
    expect(book.bookId).toBe(43);
    // The BSB leaves John 5:4 to a footnote
    expect(Object.keys(book.verses)).toHaveLength(878);
    expect(book.verses["5:4"]).toBeUndefined();
    expect(book.verses["3:16"]!.text).toBe(
      "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.",
    );
  });

  it("reads USFM, without paragraph marks", () => {
    const book = readBook(lx, topos, "usfm", fixture("3jn_kjv.usfm"))!;
    expect(book.bookId).toBe(64);
    expect(book.verses["1:1"]!.text).toMatch(/^The elder unto the wellbeloved Gaius/);
    expect(Object.values(book.verses).some((v) => v.text.includes("¶"))).toBe(false);
  });

  it("reads a verse printed in parts whole", () => {
    const usfm = "\\id 3JN\n\\c 1\n\\p\n\\v 1 One.\n\\v 2a Two begins,\n\\p\n\\v 2b and ends.\n\\v 3 Three.\n";
    const book = readBook(lx, topos, "usfm", usfm)!;
    expect(book.verses["1:2"]).toEqual({ text: "Two begins, and ends." });
    expect(Object.keys(book.verses)).toEqual(["1:1", "1:2", "1:3"]);
  });
});

describe("files", () => {
  it("tells markups apart", () => {
    expect(markupOf("a.usx", fixture("jhn_bsb.usx"))).toBe("usx");
    expect(markupOf("x.txt", fixture("3jn_kjv.usfm"))).toBe("usfm");
    expect(markupOf("notes.txt", "hello")).toBe(null);
  });

  it("reads several, skipping what isn't a book", () => {
    const enc = new TextEncoder();
    const { books, skipped } = readFiles(lx, topos, [
      { name: "JHN.usx", bytes: enc.encode(fixture("jhn_bsb.usx")) },
      { name: "64-3JN.SFM", bytes: enc.encode(fixture("3jn_kjv.usfm")) },
      { name: "cover.png", bytes: new Uint8Array([1, 2, 3]) },
    ]);
    expect(books.map((b) => b.bookId)).toEqual([43, 64]);
    expect(skipped).toEqual(["cover.png"]);
  });
});

describe("zips", () => {
  it("reads a whole Bible's books from any folder, quietly passing over the rest", () => {
    const progress: number[] = [];
    const zip = new Uint8Array(readFileSync(new URL("./fixtures/bible.zip", import.meta.url)));
    const { books, skipped } = readFiles(lx, topos, [{ name: "Bible.ZIP", bytes: zip }], (done) => progress.push(done));
    expect(books.map((b) => b.bookId).sort()).toEqual([43, 64]);
    expect(skipped).toEqual([]);
    expect(progress.at(-1)).toBe(5);
  });
});
