import { ArrowRightIcon, CheckIcon, EyeIcon, SkipForwardIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { bookById } from "@/bible/topos";
import type { VerseRef } from "@/bible/types";
import { Button } from "@/components/ui/button";
import { Input, Kbd } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { grade, partsToAsk, type Grade, type Guess, type PartResult } from "@/practice/reference";
import { advance, useSession, useVerseText } from "@/state/session";
import { useApp, useTranslation } from "@/state/store";
import { BookInput } from "./BookInput";
import { Card, focusForAnswer, Scripture, VerseStatus } from "./common";

/** A part filled in for you: still a field, but not one to type in (and not dimmed) */
const GIVEN = "text-lg font-medium disabled:cursor-default disabled:opacity-100 disabled:bg-muted disabled:text-foreground";

const partClass = (r: PartResult | undefined) =>
  cn(
    r === "correct" && "border-success bg-success-soft text-success focus-visible:border-success",
    r === "wrong" && "border-destructive bg-destructive-soft text-destructive focus-visible:border-destructive",
  );

/** Shows a verse; the reference is to be named */
export function ReferenceDrill({ verse, pool }: { verse: VerseRef; pool: VerseRef[] }) {
  const translation = useTranslation();
  const chosen = useApp((s) => s.settings.ask);
  // A book or chapter every verse shares is filled in, since it's obvious
  const { ask, obvious } = useMemo(() => partsToAsk(chosen, pool), [chosen, pool]);
  const autoAdvance = useApp((s) => s.settings.autoAdvance);
  const record = useApp((s) => s.record);
  const markMissing = useSession((s) => s.markMissing);
  const [state, retry] = useVerseText(translation, verse);

  const [guess, setGuess] = useState<Guess>({ book: "", chapter: "", verse: "" });
  const [result, setResult] = useState<(Grade & { revealed?: boolean }) | null>(null);
  const bookRef = useRef<HTMLInputElement>(null);
  const chapterRef = useRef<HTMLInputElement>(null);
  const verseRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const book = bookById(verse.bookId);
  const span = state.status === "ready" ? state.verse.span : undefined;

  // A new verse, or other parts to ask for: clear the answer
  const asking = `${ask.book}${ask.chapter}${ask.verse}`;
  useEffect(() => {
    setGuess({ book: "", chapter: "", verse: "" });
    setResult(null);
  }, [verse, asking]);

  const firstAsked = () => (ask.book ? bookRef : ask.chapter ? chapterRef : verseRef).current;
  useEffect(() => {
    if (state.status === "ready" && !result) focusForAnswer(firstAsked());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, verse, result, ask]);

  useEffect(() => {
    if (!result) return;
    focusForAnswer(nextRef.current);
    if (result.correct && autoAdvance) {
      const timer = setTimeout(() => advance(pool), 1100);
      return () => clearTimeout(timer);
    }
  }, [result, autoAdvance, pool]);

  const check = () => {
    if (result || state.status !== "ready") return;
    const empty = (ask.book && !guess.book.trim() && bookRef) || (ask.chapter && !guess.chapter && chapterRef) || (ask.verse && !guess.verse && verseRef);
    if (empty) {
      empty.current?.focus();
      return;
    }
    const g = grade(verse, guess, ask, span);
    setResult(g);
    record({ mode: "reference", verse, translation: translation.abbreviation, correct: g.correct, score: g.score, answer: g.answer });
  };

  const reveal = () => {
    if (result) return;
    const g: Grade = { book: ask.book ? "wrong" : "given", chapter: ask.chapter ? "wrong" : "given", verse: ask.verse ? "wrong" : "given", correct: false, score: 0, answer: "(shown)" };
    setResult({ ...g, revealed: true });
    record({ mode: "reference", verse, translation: translation.abbreviation, correct: false, score: 0, answer: "Shown" });
  };

  const onKey = (next: (() => void) | null) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      check();
    } else if (next && (e.key === ":" || e.key === "." || e.key === " ")) {
      e.preventDefault();
      next();
    }
  };

  const skip = () => advance(pool);
  const verseLabel = span ? `${span[0]}–${span[1]}` : String(verse.verse);

  return (
    <div data-drill className="flex flex-col gap-5">
      <Card className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
        {state.status === "ready" ? (
          <div key={`${verse.bookId}.${verse.chapter}.${verse.verse}`} className="animate-fade-up">
            <Scripture>{state.verse.text}</Scripture>
            {span && <p className="mt-4 text-xs text-muted-foreground">The {translation.abbreviation} prints verses {span[0]}–{span[1]} together; either verse counts.</p>}
          </div>
        ) : (
          <VerseStatus state={state} translation={translation} onRetry={retry} onSkip={() => { if (state.status === "missing") markMissing(verse); skip(); }} />
        )}
        <span className="absolute top-3 right-4 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">{translation.abbreviation}</span>
      </Card>

      <div className="flex flex-col items-center gap-4">
        <div className={cn("flex w-full max-w-xl flex-wrap items-center justify-center gap-2", result && !result.correct && "animate-shake")}>
          {ask.book ? (
            <BookInput
              ref={bookRef}
              value={guess.book}
              onChange={(b) => setGuess((g) => ({ ...g, book: b }))}
              onAccept={() => (ask.chapter ? chapterRef : verseRef).current?.focus()}
              onEnter={check}
              readOnly={!!result}
              className={cn("min-w-0 flex-1 basis-48", result && partInputClass(result.book))}
            />
          ) : (
            <Input disabled value={book.name} aria-label="Book" className={cn(GIVEN, "h-12 min-w-0 flex-1 basis-48")} />
          )}
          <div className="flex items-center gap-1.5">
            {ask.chapter ? (
              <Input
                ref={chapterRef}
                value={guess.chapter}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="C"
                aria-label="Chapter"
                readOnly={!!result}
                className={cn("h-12 w-16 text-center text-lg font-medium tabular-nums", partClass(result?.chapter))}
                onChange={(e) => setGuess((g) => ({ ...g, chapter: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                onKeyDown={onKey(() => verseRef.current?.focus())}
              />
            ) : (
              <Input disabled value={verse.chapter} aria-label="Chapter" className={cn(GIVEN, "h-12 w-16 text-center tabular-nums")} />
            )}
            <span className="text-lg font-semibold text-muted-foreground">:</span>
            {ask.verse ? (
              <Input
                ref={verseRef}
                value={guess.verse}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="V"
                aria-label="Verse"
                readOnly={!!result}
                className={cn("h-12 w-16 text-center text-lg font-medium tabular-nums", partClass(result?.verse))}
                onChange={(e) => setGuess((g) => ({ ...g, verse: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                onKeyDown={onKey(null)}
              />
            ) : (
              <Input disabled value={verseLabel} aria-label="Verse" className={cn(GIVEN, "h-12 text-center tabular-nums", span ? "w-20" : "w-16")} />
            )}
          </div>
        </div>

        {(obvious.book || obvious.chapter) && !result && (
          <p className="-mt-1 text-xs text-muted-foreground">
            Every verse here is in {obvious.chapter ? `${book.name} ${verse.chapter}` : book.name}, so {obvious.chapter && obvious.book ? "those are" : "that's"} filled in.
          </p>
        )}
        {result ? (
          <div className="flex w-full max-w-xl flex-col items-center gap-3 animate-fade-up">
            <div
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center",
                result.correct ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
              )}
            >
              {result.correct ? <CheckIcon className="size-5 shrink-0" /> : <XIcon className="size-5 shrink-0" />}
              <span className="font-medium">
                {result.correct ? "Correct — " : result.revealed ? "It's " : "It was "}
                <span className="font-semibold">
                  {book.name} {verse.chapter}:{verseLabel}
                </span>
                {!result.correct && !result.revealed && <span className="opacity-80"> (you said {result.answer})</span>}
              </span>
            </div>
            <Button ref={nextRef} size="lg" onClick={skip} className="min-w-40">
              Next <ArrowRightIcon /> <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={reveal} disabled={state.status !== "ready"}>
              <EyeIcon /> Show
            </Button>
            <Button size="lg" onClick={check} disabled={state.status !== "ready"} className="min-w-36">
              Check <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
            </Button>
            <Button variant="ghost" onClick={skip}>
              Skip <SkipForwardIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function partInputClass(r: PartResult) {
  return cn(
    r === "correct" && "[&_input]:border-success [&_input]:bg-success-soft [&_input]:text-success",
    r === "wrong" && "[&_input]:border-destructive [&_input]:bg-destructive-soft [&_input]:text-destructive",
  );
}
