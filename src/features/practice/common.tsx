import { AlertCircleIcon, BookXIcon, Loader2Icon, RefreshCwIcon, SkipForwardIcon } from "lucide-react";
import type { ReactNode } from "react";
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
