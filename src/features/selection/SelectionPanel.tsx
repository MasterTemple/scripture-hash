import { CheckIcon, ChevronsUpDownIcon, CrosshairIcon, ListPlusIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { completeReference } from "@/bible/topos";
import { verseKey } from "@/bible/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Badge, Input, Kbd, Progress, Textarea, Tip } from "@/components/ui/primitives";
import { cn, percent } from "@/lib/utils";
import { mastery } from "@/practice/queue";
import { useSelection, useSession } from "@/state/session";
import { useActiveSet, useApp } from "@/state/store";

const EXAMPLES = ["Romans 8", "Psalm 1; 23", "Ephesians 2:1-10", "John 1:1-18", "James", "1 Cor 13:4-7"];

export function SelectionPanel({ onPicked }: { onPicked?: () => void }) {
  const active = useActiveSet();
  const updateSet = useApp((s) => s.updateSet);
  const { passages, verses } = useSelection();
  const focus = useSession((s) => s.focus);
  const setFocus = useSession((s) => s.setFocus);
  const stats = useApp((s) => s.stats);

  const known = useMemo(() => {
    if (verses.length === 0) return 0;
    return verses.reduce((sum, v) => sum + mastery(stats[verseKey(v)]), 0) / verses.length;
  }, [verses, stats]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Room for the slide-out panel's close button, below the desktop width */}
      <div className="flex items-center gap-2 border-b py-3 pr-12 pl-4 lg:pr-4">
        <SetPicker />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-2 px-4 pt-4">
          <div className="flex items-baseline justify-between">
            <label htmlFor="selection" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Verses to learn
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {verses.length} {verses.length === 1 ? "verse" : "verses"}
            </span>
          </div>
          <ReferenceEditor value={active.text} onChange={(text) => updateSet(active.id, { text })} />
          {verses.length === 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  onClick={() => updateSet(active.id, { text: active.text.trim() ? `${active.text.trim()}\n${ex}` : ex })}
                >
                  + {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {passages.length > 0 && (
          <div className="px-4 pt-5 pb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Passages</span>
              {focus !== null ? (
                <button className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setFocus(null)}>
                  <XIcon className="size-3" /> Practice all
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">{percent(known)} known</span>
              )}
            </div>
            <ul className="space-y-1">
              {passages.map((p, i) => {
                const m = p.verses.reduce((sum, v) => sum + mastery(stats[verseKey(v)]), 0) / p.verses.length;
                const focused = focus === i;
                return (
                  <li key={`${p.reference}-${i}`}>
                    <button
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted",
                        focused && "border-primary/30 bg-accent hover:bg-accent",
                        focus !== null && !focused && "opacity-55",
                      )}
                      onClick={() => {
                        setFocus(focused ? null : i);
                        onPicked?.();
                      }}
                      title={focused ? "Practicing this passage alone. Click to practice everything." : "Practice this passage alone"}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{p.reference}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{p.verses.length} v.</span>
                        </div>
                        <Progress value={m} className="mt-1.5 h-1" indicatorClassName={cn(m >= 0.75 ? "bg-success" : m >= 0.4 ? "bg-warning" : "bg-primary/70")} />
                      </div>
                      <CrosshairIcon className={cn("size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100", focused && "text-primary opacity-100")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SetPicker() {
  const sets = useApp((s) => s.sets);
  const active = useActiveSet();
  const { addSet, updateSet, removeSet, setActiveSet } = useApp.getState();
  const setFocus = useSession((s) => s.setFocus);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (renaming) {
    const save = () => {
      if (name.trim()) updateSet(active.id, { name: name.trim() });
      setRenaming(false);
    };
    return (
      <form className="flex w-full items-center gap-1.5" onSubmit={(e) => (e.preventDefault(), save())}>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} className="h-8" aria-label="Set name" />
        <Button size="icon-sm" variant="ghost" type="submit" aria-label="Save name">
          <CheckIcon />
        </Button>
      </form>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-muted-foreground">Verse set</div>
              <div className="truncate text-sm font-semibold">{active.name}</div>
            </div>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Your sets</DropdownMenuLabel>
          {sets.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onSelect={() => {
                setActiveSet(s.id);
                setFocus(null);
              }}
            >
              <CheckIcon className={cn(s.id === active.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{s.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              addSet();
              setFocus(null);
              setName("New set");
              setRenaming(true);
            }}
          >
            <PlusIcon /> New set
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip content="Rename set">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Rename set"
          onClick={() => {
            setName(active.name);
            setRenaming(true);
          }}
        >
          <PencilIcon />
        </Button>
      </Tip>
      <DropdownMenu>
        <Tip content="Delete set">
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Delete set">
              <Trash2Icon />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent>
          <DropdownMenuLabel>Delete “{active.name}”?</DropdownMenuLabel>
          <DropdownMenuItem destructive onSelect={() => (removeSet(active.id), setFocus(null))}>
            <Trash2Icon /> Delete set
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** A textarea of references, offering completions as they're typed (Tab takes the first) */
function ReferenceEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const completions = useMemo(() => {
    if (cursor === null) return [];
    const before = value.slice(0, cursor);
    if (!/[\p{L}\d:]$/u.test(before)) return [];
    const after = value.slice(cursor);
    if (/^[\p{L}\d]/u.test(after)) return [];
    try {
      return completeReference(value, cursor, 6).filter((c) => c.text.trim() !== value.slice(c.start, c.end).trim());
    } catch {
      return [];
    }
  }, [value, cursor]);

  const accept = (i: number) => {
    const c = completions[i];
    if (!c) return;
    const next = value.slice(0, c.start) + c.text + value.slice(c.end);
    const at = c.start + c.text.length;
    onChange(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(at, at);
      setCursor(at);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && completions.length > 0 && !e.shiftKey) {
      e.preventDefault();
      accept(0);
    } else if (e.key === "Escape") {
      setCursor(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <Textarea
        ref={ref}
        id="selection"
        value={value}
        spellCheck={false}
        rows={6}
        placeholder={"John 3:16\nRomans 8:28-39\nPsalm 23\nPhilippians"}
        className="min-h-32 resize-y font-mono text-[13px] leading-relaxed"
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(e.target.selectionStart);
        }}
        onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setCursor(null), 150)}
        onKeyDown={onKeyDown}
      />
      {completions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {completions.map((c, i) => (
            <button
              key={`${c.label}-${i}`}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs transition-colors hover:border-primary/40 hover:bg-accent",
                i === 0 && "border-primary/30 bg-accent text-accent-foreground",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(i);
              }}
            >
              {c.label}
            </button>
          ))}
          <span className="ml-1 hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            <Kbd>Tab</Kbd>
          </span>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <ListPlusIcon className="size-3.5 shrink-0" />
          References, chapters, or whole books; abbreviations work.
        </p>
      )}
    </div>
  );
}

export function SelectionSummary() {
  const { pool, passages } = useSelection();
  const focus = useSession((s) => s.focus);
  if (focus !== null && passages[focus]) return <Badge>{passages[focus].reference}</Badge>;
  return <Badge variant="muted">{pool.length} verses</Badge>;
}
