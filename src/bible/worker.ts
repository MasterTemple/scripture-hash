/// <reference lib="webworker" />
// Parses USFM and USX with logoxide off the main thread: its WebAssembly is large and a
// whole Bible takes a moment, so the page stays responsive and only loads it when needed.
import { initialized, Logoxide, Topos } from "logoxide";
import { readBook, readFiles } from "./parse";
import type { BookText } from "./types";

export type WorkerRequest =
  | { id: number; type: "fetchBook"; url: string; markup: "usx" | "usfm" }
  | { id: number; type: "parseFiles"; files: { name: string; bytes: ArrayBuffer }[] };

export type WorkerResponse =
  | { id: number; ok: true; books: BookText[]; skipped: string[] }
  | { id: number; ok: false; error: string }
  | { id: number; progress: { done: number; total: number } };

let lx: Logoxide;
let topos: Topos;
const ready = initialized.then(() => {
  lx = Logoxide.new();
  topos = Topos.new();
});

async function handle(req: WorkerRequest): Promise<{ books: BookText[]; skipped: string[] }> {
  await ready;
  if (req.type === "fetchBook") {
    const response = await fetch(req.url);
    if (response.status === 404) return { books: [], skipped: [] }; // the translation lacks the book
    if (!response.ok) throw new Error(`Download failed (${response.status} ${response.statusText})`);
    const book = readBook(lx, topos, req.markup, await response.text());
    if (!book) throw new Error("The downloaded book couldn't be read");
    return { books: [book], skipped: [] };
  }
  let last = 0;
  return readFiles(lx, topos, req.files.map((f) => ({ name: f.name, bytes: new Uint8Array(f.bytes) })), (done, total) => {
    // A few updates a second is plenty
    const now = performance.now();
    if (done < total && now - last < 100) return;
    last = now;
    self.postMessage({ id: req.id, progress: { done, total } } satisfies WorkerResponse);
  });
}

const describe = (error: unknown) => {
  if (error instanceof Error) return error.message;
  // logoxide's errors carry `{ tag, message }`
  if (typeof error === "object" && error && "value" in error) {
    const value = (error as { value: { message?: string } }).value;
    if (value?.message) return value.message;
  }
  return String(error);
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    self.postMessage({ id: req.id, ok: true, ...(await handle(req)) } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({ id: req.id, ok: false, error: describe(error) } satisfies WorkerResponse);
  }
};
