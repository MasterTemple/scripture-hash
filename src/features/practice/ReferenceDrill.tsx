import { ArrowRightIcon, CheckIcon, EyeIcon, SkipForwardIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { bookById, findBook, formatPrinted, verseCount } from "@/bible/topos";
import { spanLabel, type VerseRef } from "@/bible/types";
import { Button } from "@/components/ui/button";
import { Input, Kbd } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { grade, numberDone, partsToAsk, type Grade, type Guess, type PartResult } from "@/practice/reference";
import { advance, useSession, useVerseText } from "@/state/session";
import { useApp, useTranslation } from "@/state/store";
import { BookInput } from "./BookInput";
import { Card, focusForAnswer, Scripture, VerseStatus } from "./common";

/**
 * Tapping a button leaves the focus in the field being typed in, so a phone's keyboard stays
 * up (and the page doesn't scroll away and back) from one verse to the next
 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

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
  const jumpWhenDone = useApp((s) => s.settings.jumpWhenDone);
  const rightDelay = useApp((s) => s.settings.rightDelay);
  const wrongDelay = useApp((s) => s.settings.wrongDelay);
  const record = useApp((s) => s.record);
  const markMissing = useSession((s) => s.markMissing);
  const [state, retry] = useVerseText(translation, verse);

  const [guess, setGuess] = useState<Guess>({ book: "", chapter: "", verse: "" });
  const [result, setResult] = useState<(Grade & { revealed?: boolean; jumped?: boolean }) | null>(null);
  const bookRef = useRef<HTMLInputElement>(null);
  const chapterRef = useRef<HTMLInputElement>(null);
  const verseRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const book = bookById(verse.bookId);
  const printed = state.status === "ready" ? state.verse : undefined;
  const span = printed && spanLabel(printed);

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
    // Enter in a field goes on once it's answered, so the focus stays in one to keep a phone's keyboard up
    if (!document.activeElement?.closest("[data-drill] input")) focusForAnswer(nextRef.current);
    // An answer checked by jumping ahead goes on either way, a miss after time to read the answer
    if (result.jumped || (result.correct && autoAdvance)) {
      const timer = setTimeout(() => advance(pool), (result.correct ? rightDelay : wrongDelay) * 1000);
      return () => clearTimeout(timer);
    }
  }, [result, autoAdvance, rightDelay, wrongDelay, pool]);

  /** Grades the answer; `answer` is one just typed, before its state lands, `jumped` when typing it checked it */
  const check = (answer: Guess = guess, jumped = false) => {
    if (result || state.status !== "ready") return;
    const empty = (ask.book && !answer.book.trim() && bookRef) || (ask.chapter && !answer.chapter && chapterRef) || (ask.verse && !answer.verse && verseRef);
    if (empty) {
      empty.current?.focus();
      return;
    }
    const g = grade(verse, answer, ask, printed?.span, printed?.chapters);
    setResult({ ...g, jumped });
    record({ mode: "reference", verse, translation: translation.abbreviation, correct: g.correct, score: g.score, answer: g.answer });
  };

  /**
   * A chapter or verse typed: with jumping on, one that's done moves on to the verse, or
   * checks the answer (the book, when asked, is the one guessed)
   */
  const type = (part: "chapter" | "verse", value: string) => {
    if (result) return;
    const next = { ...guess, [part]: value };
    setGuess(next);
    if (!jumpWhenDone || !value || state.status !== "ready") return;
    const bookId = ask.book ? findBook(next.book) : verse.bookId;
    const chapter = ask.chapter ? Number.parseInt(next.chapter, 10) : verse.chapter;
    const last = !bookId ? null : part === "chapter" ? bookById(bookId).chapters : chapter > 0 ? verseCount(bookId, chapter) : null;
    const right = grade(verse, next, ask, printed?.span, printed?.chapters)[part] === "correct";
    if (!numberDone(value, last, right)) return;
    if (part === "chapter" && ask.verse) verseRef.current?.focus();
    else check(next, true);
  };

  const reveal = () => {
    if (result) return;
    const g: Grade = { book: ask.book ? "wrong" : "given", chapter: ask.chapter ? "wrong" : "given", verse: ask.verse ? "wrong" : "given", correct: false, score: 0, answer: "(shown)" };
    setResult({ ...g, revealed: true });
    record({ mode: "reference", verse, translation: translation.abbreviation, correct: false, score: 0, answer: "Shown" });
  };

  const skip = () => advance(pool);

  /** `next` goes on to the following field; `back` returns to the one before, from an empty field */
  const onKey = (next: (() => void) | null, back: (() => void) | null) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (result) skip();
      else check();
    } else if (next && (e.key === ":" || e.key === "." || e.key === " ")) {
      e.preventDefault();
      next();
    } else if (back && !result && e.key === "Backspace" && !e.currentTarget.value) {
      e.preventDefault();
      back();
    }
  };

  /** Focuses the chapter with the caret after its number, to go on deleting it */
  const backToChapter = () => {
    const el = chapterRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  };

  const verseLabel = span ?? String(verse.verse);

  return (
    <div data-drill className="flex flex-col gap-5">
      <Card className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
        {state.status === "ready" ? (
          <div key={`${verse.bookId}.${verse.chapter}.${verse.verse}`} className="animate-fade-up">
            <Scripture>{state.verse.text}</Scripture>
            {span && <p className="mt-4 text-xs text-muted-foreground">The {translation.abbreviation} prints verses {span} together; either verse counts.</p>}
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
              onChange={(b) => !result && setGuess((g) => ({ ...g, book: b }))}
              onAccept={() => (ask.chapter ? chapterRef : verseRef).current?.focus()}
              onEnter={() => (result ? skip() : check())}
              locked={!!result}
              className={cn("min-w-0 flex-1 basis-48", result && partInputClass(result.book))}
            />
          ) : (
            <Input disabled value={book.name} aria-label="Book" className={cn(GIVEN, "h-12 min-w-0 flex-1 basis-48")} />
          )}
          <div className="flex items-center gap-1.5">
            {ask.chapter ? (
              <NumberField
                ref={chapterRef}
                letter="C"
                label="Chapter"
                value={guess.chapter}
                locked={!!result}
                className={partClass(result?.chapter)}
                onChange={(chapter) => type("chapter", chapter)}
                onKeyDown={onKey(() => verseRef.current?.focus(), null)}
              />
            ) : (
              <Input disabled value={verse.chapter} aria-label="Chapter" className={cn(GIVEN, "h-12 w-16 text-center tabular-nums")} />
            )}
            <span className="text-lg font-semibold text-muted-foreground">:</span>
            {ask.verse ? (
              <NumberField
                ref={verseRef}
                letter="V"
                label="Verse"
                value={guess.verse}
                locked={!!result}
                className={partClass(result?.verse)}
                onChange={(verse) => type("verse", verse)}
                onKeyDown={onKey(null, ask.chapter ? backToChapter : null)}
              />
            ) : (
              <Input disabled value={verseLabel} aria-label="Verse" className={cn(GIVEN, "h-12 text-center tabular-nums", printed?.chapters ? "w-28" : span ? "w-20" : "w-16")} />
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
                  {formatPrinted(verse, printed)}
                </span>
                {!result.correct && !result.revealed && <span className="opacity-80"> (you said {result.answer})</span>}
              </span>
            </div>
            <Button ref={nextRef} size="lg" onMouseDown={keepFocus} onClick={skip} className="min-w-40">
              Next <ArrowRightIcon /> <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onMouseDown={keepFocus} onClick={reveal} disabled={state.status !== "ready"}>
              <EyeIcon /> Show
            </Button>
            <Button size="lg" onMouseDown={keepFocus} onClick={() => check()} disabled={state.status !== "ready"} className="min-w-36">
              Check <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
            </Button>
            <Button variant="ghost" onMouseDown={keepFocus} onClick={skip}>
              Skip <SkipForwardIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A chapter or verse number. Empty, it shows its letter ("C", "V") in place of a placeholder,
 * blinking where a caret would be while it's focused; the caret shows once there's a number.
 */
function NumberField({
  ref,
  letter,
  label,
  value,
  locked,
  className,
  onChange,
  onKeyDown,
}: {
  ref: RefObject<HTMLInputElement | null>;
  letter: string;
  label: string;
  value: string;
  /** Answered: it keeps the focus (and a phone's keyboard), but typing doesn't change it */
  locked: boolean;
  className?: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <Input
        ref={ref}
        value={value}
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        aria-readonly={locked}
        className={cn("peer h-12 w-16 text-center text-lg font-medium tabular-nums", !value && "caret-transparent", className)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onKeyDown={onKeyDown}
      />
      {!value && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-medium text-muted-foreground peer-focus:animate-caret peer-focus:text-primary"
        >
          {letter}
        </span>
      )}
    </div>
  );
}

function partInputClass(r: PartResult) {
  return cn(
    r === "correct" && "[&_input]:border-success [&_input]:bg-success-soft [&_input]:text-success",
    r === "wrong" && "[&_input]:border-destructive [&_input]:bg-destructive-soft [&_input]:text-destructive",
  );
}
