import { AlertCircleIcon, BookXIcon, Loader2Icon, RefreshCwIcon, SkipForwardIcon } from "lucide-react";
import { useEffect, type ReactNode, type RefObject } from "react";
import type { Translation } from "@/bible/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VerseState } from "@/state/session";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card text-card-foreground shadow-sm", className)}>{children}</div>;
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

/**
 * On a touch screen, brings the drill to the top of the screen (under the header, when it shows)
 * when a field in it takes the focus. The browser scrolls too, as the keyboard opens (Safari
 * centers the field once the keyboard is up), and moving the page while it does makes it scroll
 * again, so this waits for the keyboard and for the page to be still, then moves it once.
 */
export function useTopOnFocus(drill: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = drill.current;
    if (!root || !matchMedia("(pointer: coarse)").matches) return;
    const viewport = window.visualViewport;
    let pending = false;
    let keyboard = false;
    let until = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const align = () => {
      pending = false;
      // With the keyboard up, the visible part of the page can start below the page's top
      const shown = viewport?.offsetTop ?? 0;
      const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const top = Math.max(header - shown, 0) + 8;
      const off = root.getBoundingClientRect().top - shown - top;
      if (Math.abs(off) > 1) window.scrollBy(0, off);
    };
    const keyboardUp = () => !!viewport && viewport.height < window.innerHeight * 0.85;
    /** Aligns once the keyboard is up and the page has been still a moment, or after a while regardless */
    const settle = () => {
      if (!pending) return;
      keyboard ||= keyboardUp();
      clearTimeout(timer);
      timer = setTimeout(align, keyboard ? 150 : Math.max(until - Date.now(), 0));
    };
    const onFocus = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      pending = true;
      keyboard = false;
      until = Date.now() + 1000;
      settle();
    };
    // Scrolling by hand is left alone
    const stop = () => {
      pending = false;
      clearTimeout(timer);
    };

    root.addEventListener("focusin", onFocus);
    viewport?.addEventListener("resize", settle);
    viewport?.addEventListener("scroll", settle);
    window.addEventListener("scroll", settle);
    window.addEventListener("touchstart", stop, { passive: true });
    return () => {
      stop();
      root.removeEventListener("focusin", onFocus);
      viewport?.removeEventListener("resize", settle);
      viewport?.removeEventListener("scroll", settle);
      window.removeEventListener("scroll", settle);
      window.removeEventListener("touchstart", stop);
    };
  }, [drill]);
}
