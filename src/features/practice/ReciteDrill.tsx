import { ArrowRightIcon, EyeIcon, KeyboardIcon, LightbulbIcon, RotateCcwIcon, SkipForwardIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { formatPrinted } from "@/bible/topos";
import type { VerseRef } from "@/bible/types";
import { Button } from "@/components/ui/button";
import { Kbd, Progress } from "@/components/ui/primitives";
import { cn, percent } from "@/lib/utils";
import { progress, typedRuns, wordParts, words, type WordState } from "@/practice/recite";
import { advance, useSession, useVerseText } from "@/state/session";
import { useApp, useTranslation } from "@/state/store";
import { useVerseFont } from "@/features/settings/FontPicker";
import { Card, focusForAnswer, VerseStatus } from "./common";

/** Shows a reference; the verse is to be typed out, word by word or by first letters */
export function ReciteDrill({ verse, pool }: { verse: VerseRef; pool: VerseRef[] }) {
  const translation = useTranslation();
  const style = useApp((s) => s.settings.reciteStyle);
  // First-letter hints would give every answer away when typing first letters
  const hints = useApp((s) => s.settings.firstLetterHints && s.settings.reciteStyle === "words");
  const liveTypos = useApp((s) => s.settings.liveTypos);
  const punctuation = useApp((s) => s.settings.showPunctuation);
  const autoAdvance = useApp((s) => s.settings.autoAdvance);
  const rightDelay = useApp((s) => s.settings.rightDelay);
  const verseFont = useVerseFont();
  const record = useApp((s) => s.record);
  const markMissing = useSession((s) => s.markMissing);
  const [state, retry] = useVerseText(translation, verse);

  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [peeking, setPeeking] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const text = state.status === "ready" ? state.verse.text : "";
  const target = useMemo(() => words(text), [text]);
  const p = useMemo(() => progress(target, input, style, revealed), [target, input, style, revealed]);
  const correct = p.complete && p.score === 1 && !peeked;

  const restart = () => {
    setInput("");
    setRevealed(new Set());
    setPeeked(false);
    setRecorded(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    setInput("");
    setRevealed(new Set());
    setPeeked(false);
    setRecorded(false);
  }, [verse, style]);

  useEffect(() => {
    if (state.status === "ready") focusForAnswer(inputRef.current);
  }, [state.status, verse]);

  // Grade once the last word is in
  useEffect(() => {
    if (!p.complete || recorded || target.length === 0) return;
    setRecorded(true);
    record({ mode: "recite", verse, translation: translation.abbreviation, correct, score: peeked ? Math.min(p.score, 0.99) : p.score });
  }, [p.complete, recorded, target.length, correct, peeked, p.score, record, verse, translation.abbreviation]);

  useEffect(() => {
    if (!p.complete) return;
    if (correct && autoAdvance) {
      const timer = setTimeout(() => advance(pool), rightDelay * 1000);
      return () => clearTimeout(timer);
    }
  }, [p.complete, correct, autoAdvance, rightDelay, pool]);

  const revealWord = () => {
    if (p.complete) return;
    setRevealed((r) => new Set(r).add(p.done));
    // What was typed of the word goes with it, not on to the next one
    if (style === "words") setInput((i) => i.replace(/\S+$/, ""));
    inputRef.current?.focus();
  };

  const endPeek = () => {
    if (!peeking) return;
    setPeeking(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  /** Helper buttons leave the keyboard with the verse (on a phone, it stays open) */
  const keepFocus = { onMouseDown: (e: React.MouseEvent) => e.preventDefault() };

  const next = () => advance(pool);
  const reference = formatPrinted(verse, state.status === "ready" ? state.verse : undefined);
  const mistakes = p.states.filter((s) => s === "wrong").length;
  const helped = p.states.filter((s) => s === "revealed").length;

  return (
    <div data-drill className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{reference}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {style === "letters" ? "Type the first letter of each word" : "Type each word, then a space"} · {translation.abbreviation}
        </p>
      </div>

      <Card className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
        {state.status === "ready" ? (
          <>
            <div
              className="relative cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {/* No ligatures: Literata joins "Th" into one glyph, which would show a hidden letter with a hint */}
              <p
                className="text-[1.3rem] leading-[1.9] [font-variant-ligatures:none] sm:text-[1.5rem] sm:leading-[1.85]"
                style={{ fontFamily: verseFont }}
                aria-live="polite"
              >
                {target.map((w, i) => (
                  <WordView
                    key={i}
                    text={w.text}
                    state={p.states[i]!}
                    typed={p.typed[i]!}
                    partial={i === p.done ? p.partial : ""}
                    hint={hints}
                    liveTypos={liveTypos}
                    punctuation={punctuation}
                    settle={style === "words"}
                    peek={peeking}
                    caret={focused && i === p.done}
                  />
                ))}
              </p>
              {/* The keyboard types here, so phones show theirs; what's typed is drawn above */}
              <textarea
                ref={inputRef}
                value={input}
                aria-label="Type the verse"
                data-swipe
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint={p.complete ? "next" : "done"}
                className="absolute inset-0 h-full w-full resize-none bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => {
                  if (p.complete && e.target.value.length > input.length) return;
                  setInput(e.target.value.replace(/\n/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (p.complete) next();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    restart();
                  }
                }}
              />
            </div>
            {!focused && !p.complete && (
              <button
                className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-sm animate-fade-up"
                onClick={() => inputRef.current?.focus()}
              >
                <KeyboardIcon className="size-3.5" /> Tap here to type
              </button>
            )}
          </>
        ) : (
          <VerseStatus state={state} translation={translation} onRetry={retry} onSkip={() => { if (state.status === "missing") markMissing(verse); next(); }} />
        )}
      </Card>

      {state.status === "ready" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full max-w-md items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {p.done}/{target.length}
            </span>
            <Progress value={target.length ? p.done / target.length : 0} indicatorClassName={cn(mistakes > 0 && "bg-warning")} />
            <span className="whitespace-nowrap tabular-nums">{mistakes} {mistakes === 1 ? "mistake" : "mistakes"}</span>
          </div>

          {p.complete ? (
            <div className="flex w-full max-w-xl flex-col items-center gap-3 animate-fade-up">
              <div className={cn("w-full rounded-xl px-4 py-3 text-center font-medium", correct ? "bg-success-soft text-success" : "bg-muted text-foreground")}>
                {correct
                  ? "Perfect — every word right."
                  : `${percent(p.score)} right${helped ? ` · ${helped} shown` : ""}${peeked ? " · peeked" : ""}`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="lg" onClick={restart}>
                  <RotateCcwIcon /> Again
                </Button>
                <Button size="lg" onClick={next} className="min-w-36">
                  Next <ArrowRightIcon /> <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="ghost"
                onPointerDown={() => {
                  setPeeking(true);
                  setPeeked(true);
                }}
                onPointerUp={endPeek}
                onPointerLeave={endPeek}
                onPointerCancel={endPeek}
                {...keepFocus}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    setPeeking(true);
                    setPeeked(true);
                  }
                }}
                onKeyUp={endPeek}
              >
                <EyeIcon /> Hold to peek
              </Button>
              <Button variant="ghost" onClick={revealWord} {...keepFocus}>
                <LightbulbIcon /> Next word
              </Button>
              <Button variant="ghost" onClick={restart} {...keepFocus}>
                <RotateCcwIcon /> Restart <Kbd>Esc</Kbd>
              </Button>
              <Button variant="ghost" onClick={next}>
                Skip <SkipForwardIcon />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One word of the verse; memoized, since only a word or two change per keystroke */
const WordView = memo(function WordView({
  text,
  state,
  typed,
  partial,
  hint,
  liveTypos,
  punctuation,
  settle,
  peek,
  caret,
}: {
  text: string;
  state: WordState;
  typed: string;
  partial: string;
  hint: boolean;
  liveTypos: boolean;
  punctuation: boolean;
  settle: boolean;
  peek: boolean;
  caret: boolean;
}) {
  // No transitions or entrance animations here: on phones they read as lag
  // The caret takes no room (its margins cancel its width), so it never moves the words after it
  const caretEl = caret ? <span className="-mr-[3px] ml-px inline-block h-[1.1em] w-0.5 translate-y-[0.18em] rounded-full bg-primary animate-caret" /> : null;
  // Whole words count on the space after them: the word settles in with a quick green fade
  if (state === "correct") return <span className={settle ? "animate-settle" : undefined}>{text} </span>;
  if (state === "wrong")
    return (
      <span className="text-destructive underline decoration-destructive/50 decoration-wavy underline-offset-4" title={`You typed “${typed}”`}>
        {text}{" "}
      </span>
    );
  if (state === "revealed") return <span className="text-warning">{text} </span>;

  const typing = state === "current" && partial !== "";

  // Hidden: a blank as wide as the word, with its punctuation shown if asked, and its first
  // letter as a hint if asked. The word being typed keeps its blank's width, with what's typed
  // drawn over it.
  const parts = punctuation ? wordParts(text) : [{ text, letters: true }];
  let hinted = !(hint && !peek && !typing);
  const blank = (
    <span className="select-none">
      {parts.map((part, i) => {
        if (!part.letters) {
          return (
            <span key={i} className={peek ? "text-muted-foreground/60" : "text-muted-foreground"}>
              {part.text}
            </span>
          );
        }
        // The first letter, as a hint (where the word's letters start)
        const first = hinted ? -1 : part.text.search(/[\p{L}\p{N}]/u);
        if (first >= 0) hinted = true;
        return (
          <span
            key={i}
            className={cn(
              "rounded-[3px]",
              peek ? "text-muted-foreground/60" : "bg-muted text-transparent",
              state === "current" && !peek && "bg-accent",
            )}
          >
            {first >= 0 ? (
              <>
                {part.text.slice(0, first)}
                <span className="text-muted-foreground">{part.text[first]}</span>
                {part.text.slice(first + 1)}
              </>
            ) : (
              part.text
            )}
          </span>
        );
      })}
    </span>
  );
  if (state !== "current") return <span>{blank} </span>;
  // The blank and what's typed share one grid cell, so they line up and the blank sets the width
  return (
    <span>
      <span className="inline-grid">
        <span className="[grid-area:1/1]">{blank}</span>
        <span className="pointer-events-none whitespace-nowrap [grid-area:1/1]">
          {typing &&
            !peek &&
            // In the word's own case and punctuation; wrong letters marked as typed, if asked
            typedRuns(text, partial).map((run, i) => (
              <span key={i} className={run.ok || !liveTypos ? undefined : "rounded-[2px] bg-destructive-soft text-destructive"}>
                {run.text}
              </span>
            ))}
          {caretEl}
        </span>
      </span>{" "}
    </span>
  );
});
