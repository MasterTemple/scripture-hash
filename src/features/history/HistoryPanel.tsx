import { CheckIcon, FlameIcon, HistoryIcon, KeyboardIcon, LocateIcon, Trash2Icon, XIcon } from "lucide-react";
import { useMemo } from "react";
import { formatRef } from "@/bible/topos";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { cn, percent, timeAgo } from "@/lib/utils";
import { useSession } from "@/state/session";
import { useApp, type Attempt } from "@/state/store";

const startOfToday = () => new Date().setHours(0, 0, 0, 0);

export function HistoryPanel({ onPicked }: { onPicked?: () => void }) {
  const history = useApp((s) => s.history);
  const clearHistory = useApp((s) => s.clearHistory);
  const resetProgress = useApp((s) => s.resetProgress);
  const setMode = useApp((s) => s.setMode);
  const setCurrent = useSession((s) => s.setCurrent);

  const summary = useMemo(() => {
    const today = history.filter((a) => a.at >= startOfToday());
    let streak = 0;
    for (const a of history) {
      if (!a.correct) break;
      streak++;
    }
    let best = 0;
    let run = 0;
    for (const a of [...history].reverse()) {
      run = a.correct ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const accuracy = today.length ? today.reduce((s, a) => s + a.score, 0) / today.length : null;
    return { today: today.length, accuracy, streak, best };
  }, [history]);

  const pick = (a: Attempt) => {
    setCurrent(a.verse);
    setMode(a.mode);
    onPicked?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <HistoryIcon className="size-4 text-muted-foreground" /> History
        </h2>
        {history.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Clear history" className="mr-6 lg:mr-0">
                <Trash2Icon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>This can't be undone</DropdownMenuLabel>
              <DropdownMenuItem onSelect={clearHistory}>
                <HistoryIcon /> Clear history, keep progress
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={resetProgress}>
                <Trash2Icon /> Clear history and progress
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 border-b px-4 py-4">
        <Stat label="Today" value={summary.today} />
        <Stat label="Accuracy" value={summary.accuracy === null ? "—" : percent(summary.accuracy)} />
        <Stat
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1">
              {summary.streak}
              {summary.streak >= 3 && <FlameIcon className="size-4 text-warning" />}
            </span>
          }
          hint={summary.best > summary.streak ? `best ${summary.best}` : undefined}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
            <HistoryIcon className="size-6 opacity-60" />
            Your answers will show up here.
          </div>
        ) : (
          <ul className="divide-y">
            {history.slice(0, 200).map((a) => (
              <li key={a.id}>
                <button className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60" onClick={() => pick(a)} title="Practice this verse again">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      a.correct ? "bg-success-soft text-success" : a.score > 0 ? "bg-muted text-warning" : "bg-destructive-soft text-destructive",
                    )}
                  >
                    {a.correct ? <CheckIcon className="size-3.5" /> : a.score > 0 ? <span className="text-[9px] font-bold">{Math.round(a.score * 100)}</span> : <XIcon className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{formatRef(a.verse)}</span>
                      {a.mode === "recite" ? <KeyboardIcon className="size-3 shrink-0 text-muted-foreground" /> : <LocateIcon className="size-3 shrink-0 text-muted-foreground" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {!a.correct && a.answer && a.mode === "reference" ? `${a.answer} · ` : ""}
                      {a.mode === "recite" && !a.correct ? `${percent(a.score)} · ` : ""}
                      {a.translation} · {timeAgo(a.at)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
