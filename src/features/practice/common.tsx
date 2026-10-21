import { AlertCircleIcon, ArrowRightIcon, BookXIcon, Loader2Icon, RefreshCwIcon, SkipForwardIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type ComponentProps, type ReactNode, type RefObject } from "react";
import type { Translation, VerseRef } from "@/bible/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { advance, type VerseState } from "@/state/session";
import { useApp } from "@/state/store";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

/** What to show in place of a verse that isn't ready */
export function VerseStatus({
  state,
  translation,
  onSkip,
  onRetry,
}: {
  state: Exclude<VerseState, { status: "ready" }>;
  translation: Translation;
  onSkip: () => void;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
        <span>Loading {translation.abbreviation}…</span>
      </div>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <BookXIcon className="size-6" />
        <p>
          The {translation.abbreviation} doesn't have this verse
          {translation.source.kind === "upload" ? " (its book wasn't uploaded)" : ""}.
        </p>
        <Button variant="outline" size="sm" onClick={onSkip}>
          <SkipForwardIcon /> Skip it
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-sm">
      <AlertCircleIcon className="size-6 text-destructive" />
      <p className="max-w-sm text-muted-foreground">
        Couldn't load the {translation.abbreviation}: {state.error}
      </p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon /> Try again
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onSkip}>
          <SkipForwardIcon /> Skip
        </Button>
      </div>
    </div>
  );
}

/** The verse text, set for reading */
export function Scripture({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-serif text-[1.35rem] leading-[1.7] text-pretty sm:text-[1.55rem] sm:leading-[1.65]", className)}>
      {children}
    </p>
  );
}

/**
 * Focuses a field for the next answer, unless something else has the keyboard: a field
 * outside the practice area (like the verse list being edited) or an open panel or dialog.
 */
export function focusForAnswer(el: HTMLElement | null) {
  if (!el || document.querySelector("[role=dialog]")) return;
  const active = document.activeElement;
  const typingElsewhere =
    active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable=true]") && !active.closest("[data-drill]");
  if (!typingElsewhere) el.focus({ preventScroll: true });
}

const coarse = typeof window !== "undefined" ? matchMedia("(pointer: coarse)") : null;
const onCoarseChange = (fn: () => void) => {
  coarse?.addEventListener("change", fn);
  return () => coarse?.removeEventListener("change", fn);
};

/** Whether the screen is touched rather than pointed at, as a phone's is */
export const useDocked = () => useSyncExternalStore(onCoarseChange, () => !!coarse?.matches, () => false);

/**
 * While a field in `drill` is focused on a touch screen (the keyboard is up), it fills just the
 * part of the screen the keyboard leaves, with the page behind kept still, so nothing has to
 * scroll to keep the verse and the answer in view. Whether it's doing so.
 */
export function useTypingView(drill: RefObject<HTMLElement | null>, on: boolean): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const root = drill.current;
    if (!root || !on) return;
    const viewport = window.visualViewport;
    // Against the page's own height, which a keyboard doesn't change (Safari's innerHeight can shrink with it)
    const keyboardUp = () => !!viewport && viewport.height < document.documentElement.clientHeight * 0.85;
    let keyboardSeen = false;
    // A tap on a field, even one focused already; focus given on its own (as a verse comes up) opens
    // no keyboard, so counts only with one up
    const onTap = (e: MouseEvent) => e.target instanceof HTMLInputElement && setTyping(true);
    const onFocus = (e: FocusEvent) => e.target instanceof HTMLInputElement && keyboardUp() && setTyping(true);
    // Leaving for somewhere outside the drill, or nowhere
    const onBlur = (e: FocusEvent) => !(e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) && setTyping(false);
    // The keyboard opened for a field already focused, or closed with the focus left in one (Android's back button)
    const onResize = () => {
      if (keyboardUp()) {
        keyboardSeen = true;
        if (document.activeElement instanceof HTMLInputElement && root.contains(document.activeElement)) setTyping(true);
      } else if (keyboardSeen) {
        keyboardSeen = false;
        setTyping(false);
      }
    };
    root.addEventListener("click", onTap);
    root.addEventListener("focusin", onFocus);
    root.addEventListener("focusout", onBlur);
    viewport?.addEventListener("resize", onResize);
    return () => {
      root.removeEventListener("click", onTap);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("focusout", onBlur);
      viewport?.removeEventListener("resize", onResize);
      setTyping(false);
    };
  }, [drill, on]);

  useLayoutEffect(() => {
    const root = drill.current;
    if (!root || !typing) return;
    const viewport = window.visualViewport;
    // Where the keyboard leaves room, followed each frame: Safari slides the visible part of the
    // page about as the keyboard opens without telling in time, and a moment behind looks dragged.
    // Once it's still, the page goes to its top, where the drill and what's visible line up for
    // sure (Safari can leave them apart until it next scrolls); it's put back after.
    const saved = window.scrollY;
    let top = -1;
    let height = -1;
    let changed = 0;
    let tries = 0;
    let frame = 0;
    const place = () => {
      const t = viewport?.offsetTop ?? 0;
      const h = viewport?.height ?? window.innerHeight;
      if (t !== top || h !== height) {
        if (h !== height) tries = 0;
        top = t;
        height = h;
        changed = performance.now();
        root.style.top = `${t}px`;
        root.style.height = `${h}px`;
      } else if (tries < 2 && (t !== 0 || window.scrollY !== 0) && performance.now() - changed > 150) {
        tries++;
        changed = performance.now();
        window.scrollTo(0, 0);
      }
      frame = requestAnimationFrame(place);
    };
    place();
    // Dragging doesn't slide the page about under it, though a verse too long to fit scrolls
    const hold = (e: TouchEvent) => {
      const scroller = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-scrolls]") : null;
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) e.preventDefault();
    };
    const page = document.documentElement;
    page.style.overflow = "hidden";
    root.addEventListener("touchmove", hold, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      page.style.overflow = "";
      // Once the drill is back in the page, which is short of it until then
      requestAnimationFrame(() => window.scrollTo(0, saved));
      root.removeEventListener("touchmove", hold);
      root.style.top = "";
      root.style.height = "";
    };
  }, [drill, typing]);

  return typing;
}

/**
 * Once a verse is answered, goes on to the next after the pause set for a right or a wrong
 * answer, if moving on by itself is on for it. The pause in seconds, or null to wait for Next.
 */
export function useMoveOn(answered: boolean, correct: boolean, pool: VerseRef[]): number | null {
  const delay = useApp((s) =>
    !answered ? null : correct ? (s.settings.autoAdvance ? s.settings.rightDelay : null) : s.settings.advanceWrong ? s.settings.wrongDelay : null,
  );
  useEffect(() => {
    if (delay === null) return;
    const timer = setTimeout(() => advance(pool), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay, pool]);
  return delay;
}

/** Lights a card's border green or red for a moment as a verse is answered */
export const flash = (answered: boolean, correct: boolean) =>
  answered && cn("animate-flash", correct ? "[--flash:var(--success)]" : "[--flash:var(--destructive)]");

/**
 * On to the next verse. Going on by itself (`delay` seconds), it fills up as the time passes;
 * waiting to be pressed, its arrow nudges.
 */
export function NextButton({ delay, className, children, ...props }: ComponentProps<typeof Button> & { delay: number | null }) {
  return (
    <Button className={cn("relative isolate overflow-hidden", delay === null && "[&_.lucide-arrow-right]:animate-nudge", className)} {...props}>
      {delay !== null && (
        <span aria-hidden className="absolute inset-0 -z-10 origin-left bg-primary-foreground/25" style={{ animation: `fill ${delay}s linear` }} />
      )}
      {children ?? <ArrowRightIcon />}
    </Button>
  );
}
