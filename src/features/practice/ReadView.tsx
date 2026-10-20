import { BookOpenIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { loadBook } from "@/bible/library";
import { bookById } from "@/bible/topos";
import { spanLabel, verseKey, type BookText, type SelectedPassage, type Translation } from "@/bible/types";
import { cn } from "@/lib/utils";
import { mastery } from "@/practice/queue";
import { useSession } from "@/state/session";
import { useApp, useTranslation } from "@/state/store";
import { Card } from "./common";

function useBook(translation: Translation, bookId: number) {
  const [book, setBook] = useState<{ key: string; book: BookText | null; error?: string } | null>(null);
  const key = `${translation.id}/${bookId}`;
  useEffect(() => {
    let live = true;
    loadBook(translation, bookId).then(
      (b) => live && setBook({ key, book: b }),
      (e: Error) => live && setBook({ key, book: null, error: e.message }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return book?.key === key ? book : null;
}

/** The selection's text, to read through before practicing */
export function ReadView({ passages }: { passages: SelectedPassage[] }) {
  const focus = useSession((s) => s.focus);
  const shown = focus !== null && passages[focus] ? [passages[focus]] : passages;
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {shown.map((p, i) => (
        <PassageText key={`${p.reference}-${i}`} passage={p} />
      ))}
    </div>
  );
}

function PassageText({ passage }: { passage: SelectedPassage }) {
  const translation = useTranslation();
  const loaded = useBook(translation, passage.bookId);
  const stats = useApp((s) => s.stats);
  const setMode = useApp((s) => s.setMode);
  const setCurrent = useSession((s) => s.setCurrent);
  const book = bookById(passage.bookId);
  const limit = 400;
  const verses = passage.verses.slice(0, limit);
  let lastChapter = -1;
  let lastSpan = "";

  return (
    <Card className="px-6 py-6 sm:px-9 sm:py-8">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-xl font-semibold">{passage.reference}</h3>
        <span className="text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">{translation.abbreviation}</span>
      </div>
      {!loaded ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Loading {book.name}…
        </div>
      ) : loaded.error || !loaded.book ? (
        <p className="py-4 text-sm text-muted-foreground">
          {loaded.error ? `Couldn't load ${book.name}: ${loaded.error}` : `The ${translation.abbreviation} doesn't have ${book.name}.`}
        </p>
      ) : (
        <p className="font-serif text-lg leading-[1.85]">
          {verses.map((v) => {
            const entry = loaded.book!.verses[`${v.chapter}:${v.verse}`];
            const chapterBreak = v.chapter !== lastChapter && lastChapter !== -1;
            const newChapter = v.chapter !== lastChapter;
            lastChapter = v.chapter;
            // Verses printed together are shown once
            const spanKey = entry?.span ? `${entry.chapters?.[0] ?? v.chapter}:${entry.span[0]}` : "";
            if (spanKey && spanKey === lastSpan) return null;
            lastSpan = spanKey;
            const m = mastery(stats[verseKey(v)]);
            const seen = (stats[verseKey(v)]?.attempts ?? 0) > 0;
            return (
              <span key={verseKey(v)}>
                {chapterBreak && <span className="block h-3" />}
                <button
                  className="group rounded-sm text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                  title="Practice this verse"
                  onClick={() => {
                    setCurrent(v);
                    setMode("recite");
                  }}
                >
                  <sup className={cn("mr-1 font-sans text-[0.62em] font-semibold", seen ? (m >= 0.75 ? "text-success" : m >= 0.45 ? "text-warning" : "text-destructive") : "text-muted-foreground")}>
                    {entry?.chapters ? spanLabel(entry) : (
                      <>
                        {newChapter && passage.verses.some((x) => x.chapter !== v.chapter) ? `${v.chapter}:` : ""}
                        {(entry && spanLabel(entry)) ?? v.verse}
                      </>
                    )}
                  </sup>
                  {entry ? entry.text : <span className="text-sm text-muted-foreground italic">(not in the {translation.abbreviation})</span>}
                </button>{" "}
              </span>
            );
          })}
        </p>
      )}
      {passage.verses.length > limit && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenIcon className="size-3.5" /> Showing the first {limit} of {passage.verses.length} verses.
        </p>
      )}
    </Card>
  );
}
