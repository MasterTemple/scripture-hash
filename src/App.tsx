import { BookOpenIcon, ChevronDownIcon, HistoryIcon, KeyboardIcon, ListIcon, LocateIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/overlays";
import { Tip, TooltipProvider } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { useDocumentSwipe } from "@/lib/swipe";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { ReadView } from "@/features/practice/ReadView";
import { ReciteDrill } from "@/features/practice/ReciteDrill";
import { ReferenceDrill } from "@/features/practice/ReferenceDrill";
import { SelectionPanel, SelectionSummary } from "@/features/selection/SelectionPanel";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { TabSettings } from "@/features/settings/TabSettings";
import { TranslationDialog } from "@/features/translations/TranslationDialog";
import { usePrefetch, useKeepCurrent, useSelection, useSession } from "@/state/session";
import { useApp, useTranslation, type Mode } from "@/state/store";

function useTheme() {
  const theme = useApp((s) => s.settings.theme);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = dark ? "#111114" : "#f7f5f1";
      document.head.append(meta);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

const MODES: { value: Mode; label: string; icon: typeof LocateIcon; title: string }[] = [
  { value: "reference", label: "Reference", icon: LocateIcon, title: "See a verse, name its reference" },
  { value: "recite", label: "Recite", icon: KeyboardIcon, title: "See a reference, type its verse" },
  { value: "read", label: "Read", icon: BookOpenIcon, title: "Read through the verses" },
];

function ModeSwitch({ className }: { className?: string }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  return (
    <Segmented<Mode>
      value={mode}
      onChange={setMode}
      className={className}
      options={MODES.map((m) => ({
        value: m.value,
        title: m.title,
        label: (
          <>
            <m.icon /> {m.label}
          </>
        ),
      }))}
    />
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path d="M12 7.5 10.5 24.5M21.5 7.5 20 24.5M7.5 13h17.5M7 19.5h17.5" className="stroke-primary-foreground" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </svg>
      <span className="hidden font-serif text-lg font-semibold tracking-tight sm:inline">Scripture Hash</span>
    </div>
  );
}

export default function App() {
  useTheme();
  const mode = useApp((s) => s.mode);
  const translation = useTranslation();
  const activeSetId = useApp((s) => s.activeSetId);
  const selection = useSelection();
  const current = useSession((s) => s.current);
  const asked = useSession((s) => s.asked);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [translationsOpen, setTranslationsOpen] = useState(false);

  // On phones and tablets: swipe right for the verse list, left for history; swipe back to close
  useDocumentSwipe((direction) => {
    if (leftOpen) return direction === "left" && setLeftOpen(false);
    if (rightOpen) return direction === "right" && setRightOpen(false);
    if (document.querySelector("[role=dialog]")) return; // settings or translations are open
    if (direction === "right" && !matchMedia("(min-width: 64rem)").matches) setLeftOpen(true);
    if (direction === "left" && !matchMedia("(min-width: 80rem)").matches) setRightOpen(true);
  });

  useKeepCurrent(selection.pool);
  usePrefetch(selection.verses);

  // Another set starts fresh
  const shownSet = useRef(activeSetId);
  useEffect(() => {
    if (shownSet.current === activeSetId) return;
    shownSet.current = activeSetId;
    useSession.setState({ focus: null, asked: new Set() });
  }, [activeSetId]);

  const empty = selection.pool.length === 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <Dialog open={leftOpen} onOpenChange={setLeftOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Verses">
                  <ListIcon />
                </Button>
              </DialogTrigger>
              <SheetContent side="left" title="Verses">
                <SelectionPanel onPicked={() => setLeftOpen(false)} />
              </SheetContent>
            </Dialog>
            <Logo />
            <div className="flex flex-1 justify-center">
              <ModeSwitch className="hidden md:inline-flex" />
            </div>
            <Dialog open={translationsOpen} onOpenChange={setTranslationsOpen}>
              <Tip content={translation.name}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 font-semibold">
                    {translation.abbreviation}
                    <ChevronDownIcon className="text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </Tip>
              {translationsOpen && <TranslationDialog onDone={() => setTranslationsOpen(false)} />}
            </Dialog>
            <Dialog>
              <Tip content="Settings">
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Settings">
                    <SettingsIcon />
                  </Button>
                </DialogTrigger>
              </Tip>
              <SettingsDialog />
            </Dialog>
            <Dialog open={rightOpen} onOpenChange={setRightOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden" aria-label="History">
                  <HistoryIcon />
                </Button>
              </DialogTrigger>
              <SheetContent side="right" title="History">
                <HistoryPanel onPicked={() => setRightOpen(false)} />
              </SheetContent>
            </Dialog>
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[19rem_1fr] xl:grid-cols-[19rem_1fr_20rem]">
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] border-r bg-background lg:block">
            <SelectionPanel />
          </aside>

          <main className="min-w-0 px-4 pt-5 pb-16 sm:px-8 sm:pt-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <ModeSwitch className="w-full md:hidden" />
              {empty ? (
                <EmptyState onOpen={() => setLeftOpen(true)} hasVerses={selection.verses.length > 0} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <SelectionSummary />
                    {mode !== "read" && <RoundProgress asked={asked.size} total={selection.pool.length} />}
                  </div>
                  {mode === "read" ? (
                    <ReadView passages={selection.passages} />
                  ) : current ? (
                    mode === "reference" ? (
                      <ReferenceDrill verse={current} pool={selection.pool} />
                    ) : (
                      <ReciteDrill verse={current} pool={selection.pool} />
                    )
                  ) : null}
                  <TabSettings />
                </>
              )}
            </div>
          </main>

          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] border-l bg-background xl:block">
            <HistoryPanel />
          </aside>
        </div>
      </div>
      <Toaster position="bottom-center" richColors closeButton theme={document.documentElement.classList.contains("dark") ? "dark" : "light"} />
    </TooltipProvider>
  );
}

function RoundProgress({ asked, total }: { asked: number; total: number }) {
  const order = useApp((s) => s.settings.order);
  if (order !== "shuffle" || total < 2) return null;
  return (
    <span className="tabular-nums" title="Each verse is asked once before any repeats">
      Round: {Math.min(asked, total)} of {total}
    </span>
  );
}

function EmptyState({ onOpen, hasVerses }: { onOpen: () => void; hasVerses: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <SparklesIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-semibold">{hasVerses ? "Nothing left to practice" : "Choose verses to learn"}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasVerses
            ? "This translation doesn't have the verses selected. Try another translation."
            : "Write references like “Romans 8:28-39” or “Psalm 23” in the verse list."}
        </p>
      </div>
      <Button className="lg:hidden" onClick={onOpen}>
        <ListIcon /> Open the verse list
      </Button>
    </div>
  );
}
