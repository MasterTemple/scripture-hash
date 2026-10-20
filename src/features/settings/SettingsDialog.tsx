import { ArrowDownWideNarrowIcon, ListOrderedIcon, MonitorIcon, MoonIcon, ShuffleIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DialogContent } from "@/components/ui/overlays";
import { Label, Switch } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { useSession } from "@/state/session";
import { FontPicker, useVerseFont } from "./FontPicker";
import { useApp, type Order, type ReciteStyle, type Settings, type Theme } from "@/state/store";

function Row({ title, description, children, htmlFor }: { title: string; description?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={htmlFor} className="text-sm">
          {title}
        </Label>
        {description && <p className="text-xs leading-snug text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 py-3">
      <h3 className="pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}

export function SettingsDialog() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const ask = settings.ask;
  const askCount = Number(ask.book) + Number(ask.chapter) + Number(ask.verse);

  const toggleAsk = (part: keyof Settings["ask"]) => (on: boolean) => {
    if (!on && askCount === 1) return;
    update({ ask: { ...ask, [part]: on } });
  };

  return (
    <DialogContent title="Settings" description="Saved on this device.">
      <Section title="Naming the reference">
        <div className="py-3">
          <p className="mb-2.5 text-xs text-muted-foreground">Ask me for…</p>
          <div className="grid grid-cols-3 gap-2">
            {(["book", "chapter", "verse"] as const).map((part) => (
              <button
                key={part}
                onClick={() => toggleAsk(part)(!ask[part])}
                disabled={ask[part] && askCount === 1}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors disabled:cursor-not-allowed",
                  ask[part] ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                aria-pressed={ask[part]}
              >
                {part}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Parts not asked for are filled in for you, and so are a book or chapter shared by every verse you're practicing.
          </p>
        </div>
      </Section>

      <Section title="Reciting">
        <Row title="Type" description={settings.reciteStyle === "letters" ? "One key per word: its first letter." : "Each word in full, then a space."}>
          <Segmented<ReciteStyle>
            size="sm"
            value={settings.reciteStyle}
            onChange={(reciteStyle) => update({ reciteStyle })}
            options={[
              { value: "letters", label: "First letters" },
              { value: "words", label: "Whole words" },
            ]}
          />
        </Row>
        <div className="space-y-2 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm">Font</Label>
              <p className="text-xs leading-snug text-muted-foreground">What the verse is typed in.</p>
            </div>
            <div className="w-48 shrink-0 sm:w-56">
              <FontPicker />
            </div>
          </div>
          <FontPreview />
        </div>
        {settings.reciteStyle === "words" && (
          <Row title="First-letter hints" description="Show each hidden word's first letter." htmlFor="hints">
            <Switch id="hints" checked={settings.firstLetterHints} onCheckedChange={(firstLetterHints) => update({ firstLetterHints })} />
          </Row>
        )}
      </Section>

      <Section title="Practice">
        <Row
          title="Order"
          description={
            settings.order === "shuffle"
              ? "Random, each verse once before any repeat."
              : settings.order === "sequential"
                ? "Straight through the selection."
                : "Random, favoring verses you miss."
          }
        >
          <Segmented<Order>
            size="sm"
            value={settings.order}
            onChange={(order) => {
              update({ order });
              useSession.setState({ asked: new Set() });
            }}
            options={[
              { value: "shuffle", label: <ShuffleIcon />, title: "Shuffle" },
              { value: "sequential", label: <ListOrderedIcon />, title: "In order" },
              { value: "weakest", label: <ArrowDownWideNarrowIcon />, title: "Weakest first" },
            ]}
          />
        </Row>
        <Row title="Move on when right" description="Go to the next verse after a correct answer." htmlFor="auto">
          <Switch id="auto" checked={settings.autoAdvance} onCheckedChange={(autoAdvance) => update({ autoAdvance })} />
        </Row>
      </Section>

      <Section title="Appearance">
        <Row title="Theme">
          <Segmented<Theme>
            size="sm"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "light", label: <SunIcon />, title: "Light" },
              { value: "dark", label: <MoonIcon />, title: "Dark" },
              { value: "system", label: <MonitorIcon />, title: "System" },
            ]}
          />
        </Row>
      </Section>
      <div className="h-2" />
    </DialogContent>
  );
}

/** A line of verse in the chosen font, half typed, as reciting shows it */
function FontPreview() {
  const family = useVerseFont();
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-lg leading-relaxed [font-variant-ligatures:none]" style={{ fontFamily: family }}>
      For God so loved the{" "}
      <span className="rounded-[3px] bg-accent text-transparent select-none">world,</span>{" "}
      <span className="rounded-[3px] bg-muted text-transparent select-none">that</span>{" "}
      <span className="rounded-[3px] bg-muted text-transparent select-none">He</span>{" "}
      <span className="rounded-[3px] bg-muted text-transparent select-none">gave</span>
    </p>
  );
}
