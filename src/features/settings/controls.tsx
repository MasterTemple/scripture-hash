import { ArrowDownWideNarrowIcon, ListOrderedIcon, ShuffleIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Label, Switch } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { useSession } from "@/state/session";
import { useApp, type Order, type ReciteStyle, type Settings } from "@/state/store";
import { FontPicker, useVerseFont } from "./FontPicker";

// The settings, each bound to the store, shared by the settings dialog and the panel under
// the practice area

export function Row({ title, description, children, htmlFor }: { title: string; description?: ReactNode; children: ReactNode; htmlFor?: string }) {
  // With a control to label, the title and description both toggle it
  const Text = htmlFor ? Label : "div";
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <Text htmlFor={htmlFor} className={cn("block space-y-0.5", htmlFor && "cursor-pointer")}>
        <span className="block text-sm font-medium">{title}</span>
        {description && <span className="block text-xs leading-snug font-normal text-muted-foreground">{description}</span>}
      </Text>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SwitchRow({ title, description, setting }: { title: string; description: string; setting: "showPunctuation" | "liveTypos" | "firstLetterHints" | "autoAdvance" | "jumpWhenDone" }) {
  const id = useId();
  const on = useApp((s) => s.settings[setting]);
  const update = useApp((s) => s.updateSettings);
  return (
    <Row title={title} description={description} htmlFor={id}>
      <Switch id={id} checked={on} onCheckedChange={(v) => update({ [setting]: v })} />
    </Row>
  );
}

/** Which parts of a reference to ask for (at least one) */
export function AskParts({ note = true }: { note?: boolean }) {
  const ask = useApp((s) => s.settings.ask);
  const update = useApp((s) => s.updateSettings);
  const count = Number(ask.book) + Number(ask.chapter) + Number(ask.verse);
  const toggle = (part: keyof Settings["ask"]) => {
    if (ask[part] && count === 1) return;
    update({ ask: { ...ask, [part]: !ask[part] } });
  };
  return (
    <div className="py-3">
      <p className="mb-2.5 text-xs text-muted-foreground">Ask me for…</p>
      <div className="grid grid-cols-3 gap-2">
        {(["book", "chapter", "verse"] as const).map((part) => (
          <button
            key={part}
            onClick={() => toggle(part)}
            disabled={ask[part] && count === 1}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors disabled:cursor-not-allowed",
              ask[part] ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={ask[part]}
          >
            {part}
          </button>
        ))}
      </div>
      {note && (
        <p className="mt-2 text-xs text-muted-foreground">
          Parts not asked for are filled in for you, and so are a book or chapter shared by every verse you're practicing.
        </p>
      )}
    </div>
  );
}

export function ReciteStyleRow() {
  const style = useApp((s) => s.settings.reciteStyle);
  const update = useApp((s) => s.updateSettings);
  return (
    <Row title="Type" description={style === "letters" ? "One key per word: its first letter." : "Each word in full, then a space."}>
      <Segmented<ReciteStyle>
        size="sm"
        value={style}
        onChange={(reciteStyle) => update({ reciteStyle })}
        options={[
          { value: "letters", label: "First letters" },
          { value: "words", label: "Whole words" },
        ]}
      />
    </Row>
  );
}

export function FontRow({ preview = true }: { preview?: boolean }) {
  return (
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
      {preview && <FontPreview />}
    </div>
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

export const PunctuationRow = () => (
  <SwitchRow title="Show punctuation" description="Show hidden words' punctuation, so each blank is only letters to type." setting="showPunctuation" />
);

/** Settings for typing whole words; nothing when typing first letters */
export function WholeWordRows() {
  const style = useApp((s) => s.settings.reciteStyle);
  if (style !== "words") return null;
  return (
    <>
      <SwitchRow title="Show typos as I type" description="Mark a wrong letter right away, not once the word is done." setting="liveTypos" />
      <SwitchRow title="First-letter hints" description="Show each hidden word's first letter." setting="firstLetterHints" />
    </>
  );
}

export function OrderRow() {
  const order = useApp((s) => s.settings.order);
  const update = useApp((s) => s.updateSettings);
  return (
    <Row
      title="Order"
      description={
        order === "shuffle" ? "Random, each verse once before any repeat." : order === "sequential" ? "Straight through the selection." : "Random, favoring verses you miss."
      }
    >
      <Segmented<Order>
        size="sm"
        value={order}
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
  );
}

/** Moving on after a right answer, and how long it shows first */
export function AutoAdvanceRow() {
  const on = useApp((s) => s.settings.autoAdvance);
  return (
    <>
      <SwitchRow title="Move on when right" description="Go to the next verse after a correct answer." setting="autoAdvance" />
      {on && <DelayRow title="Pause when right" description="How long a right answer shows first." setting="rightDelay" seconds={[0.5, 0.8, 1.2, 2]} />}
    </>
  );
}

/** How long an answer shows before going on, in seconds */
function DelayRow({ title, description, setting, seconds }: { title: string; description: string; setting: "rightDelay" | "wrongDelay"; seconds: number[] }) {
  const value = useApp((s) => s.settings[setting]);
  const update = useApp((s) => s.updateSettings);
  return (
    <Row title={title} description={description}>
      <Segmented<string>
        size="sm"
        value={String(value)}
        onChange={(v) => update({ [setting]: Number(v) })}
        options={seconds.map((n) => ({ value: String(n), label: `${n}s`, title: `${n} seconds` }))}
      />
    </Row>
  );
}

/** Jumping ahead as a reference is typed, and how long a miss it checks shows */
export function JumpRow() {
  const on = useApp((s) => s.settings.jumpWhenDone);
  return (
    <>
      <SwitchRow
        title="Jump ahead as I type"
        description="Once a chapter or verse is right, or no more digits could follow it, go on to the verse, or check and then go to the next verse."
        setting="jumpWhenDone"
      />
      {on && <DelayRow title="Pause when wrong" description="How long a miss checked by jumping ahead shows the answer." setting="wrongDelay" seconds={[1, 2, 3, 5]} />}
    </>
  );
}
