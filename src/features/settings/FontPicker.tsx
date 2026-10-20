import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, MonitorSmartphoneIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Input } from "@/components/ui/primitives";
import {
  BUILT_IN_FONTS,
  canListDeviceFonts,
  cssFamily,
  listDeviceFonts,
  loadFont,
  loadFontCatalog,
  previewFont,
  sameFont,
  type CatalogFont,
  type FontCategory,
  type FontChoice,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/store";

type Filter = "all" | "monospace" | "serif" | "sans-serif" | "handwriting" | "display" | "device";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "monospace", label: "Monospace" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans" },
  { value: "handwriting", label: "Handwriting" },
  { value: "display", label: "Display" },
];

const CATEGORY_LABEL: Record<FontCategory, string> = {
  serif: "Serif",
  "sans-serif": "Sans",
  monospace: "Mono",
  handwriting: "Hand",
  display: "Display",
  other: "Other",
};

const SAMPLE = "For God so loved the world";
const LIMIT = 120;

interface Option {
  font: FontChoice;
  catalog?: CatalogFont;
}

/** The chosen verse font, loaded; its CSS family */
export function useVerseFont(): string {
  const font = useApp((s) => s.settings.reciteFont);
  useEffect(() => {
    loadFont(font).catch(() => {});
  }, [font]);
  return cssFamily(font);
}

/** Picks the font the verse is typed in, from every font there is, each shown in itself */
export function FontPicker() {
  const value = useApp((s) => s.settings.reciteFont);
  const update = useApp((s) => s.updateSettings);
  const family = useVerseFont();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left shadow-xs transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
          aria-label={`Verse font: ${value.family}`}
        >
          <span className="truncate text-base" style={{ fontFamily: family }}>
            {value.family}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(calc(100vw-1.5rem),24rem)] p-0">
        <FontList
          value={value}
          onPick={(font, catalog) => {
            loadFont(font, catalog).catch(() => {});
            update({ reciteFont: font });
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function FontList({ value, onPick }: { value: FontChoice; onPick: (f: FontChoice, c?: CatalogFont) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(value.category === "monospace" ? "monospace" : "all");
  const [catalog, setCatalog] = useState<CatalogFont[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [device, setDevice] = useState<FontChoice[] | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    loadFontCatalog().then(setCatalog, (e: Error) => setCatalogError(e.message));
  }, []);

  const options = useMemo(() => {
    const all: Option[] = [
      ...BUILT_IN_FONTS.map((font) => ({ font })),
      ...(device ?? []).map((font) => ({ font })),
      ...(catalog ?? []).map((c) => ({
        font: { source: "fontsource" as const, family: c.family, id: c.id, category: c.category },
        catalog: c,
      })),
    ];
    const q = query.trim().toLowerCase();
    const scored: [Option, number][] = [];
    for (const o of all) {
      if (filter === "device" ? o.font.source !== "local" : filter !== "all" && o.font.category !== filter) continue;
      const name = o.font.family.toLowerCase();
      let score = 0;
      if (q) {
        if (name.startsWith(q)) score = 0;
        else if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) score = 1;
        else if (name.includes(q) || name.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) score = 2;
        else continue;
      }
      scored.push([o, score * 10 + (o.font.source === "builtin" ? 0 : o.font.source === "local" ? 1 : 2)]);
    }
    return scored.sort((a, b) => a[1] - b[1] || a[0].font.family.localeCompare(b[0].font.family)).map(([o]) => o);
  }, [catalog, device, query, filter]);

  const shown = options.slice(0, LIMIT);

  useEffect(() => setActive(0), [query, filter]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      onPick(shown[active].font, shown[active].catalog);
    }
  };

  const askDevice = async () => {
    setFilter("device");
    if (device) return;
    try {
      setDevice(await listDeviceFonts());
    } catch (e) {
      setDeviceError(e instanceof Error && e.name === "NotAllowedError" ? "Access to this device's fonts wasn't allowed." : String(e));
    }
  };

  return (
    <div className="flex max-h-[min(32rem,var(--radix-popover-content-available-height,70dvh))] flex-col" onKeyDown={onKeyDown}>
      <div className="space-y-2 border-b p-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={catalog ? `Search ${(catalog.length + BUILT_IN_FONTS.length).toLocaleString()} fonts` : "Search fonts"}
            className="pl-8"
            role="combobox"
            aria-expanded
            aria-controls="font-list"
            aria-activedescendant={shown[active] ? `font-${active}` : undefined}
          />
        </div>
        <div className="-mx-2 flex gap-1 overflow-x-auto px-2 pb-0.5 scrollbar-thin">
          {FILTERS.map((f) => (
            <Chip key={f.value} on={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
          {canListDeviceFonts() && (
            <Chip on={filter === "device"} onClick={askDevice}>
              <MonitorSmartphoneIcon className="size-3" /> This device
            </Chip>
          )}
        </div>
      </div>

      <ul ref={listRef} id="font-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1 scrollbar-thin">
        {shown.map((o, i) => (
          <FontRow
            key={`${o.font.source}:${o.font.family}`}
            index={i}
            option={o}
            active={i === active}
            selected={sameFont(o.font, value)}
            onHover={() => setActive(i)}
            onPick={() => onPick(o.font, o.catalog)}
          />
        ))}
        {filter === "device" && !device && !deviceError && (
          <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Asking for this device's fonts…
          </li>
        )}
        {filter === "device" && deviceError && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{deviceError}</li>}
        {!catalog && !catalogError && filter !== "device" && (
          <li className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" /> Loading more fonts…
          </li>
        )}
        {catalogError && filter !== "device" && (
          <li className="px-3 py-3 text-center text-xs text-muted-foreground">More fonts need a connection ({catalogError}).</li>
        )}
        {shown.length === 0 && (catalog || catalogError) && filter !== "device" && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No fonts match “{query}”.</li>
        )}
        {options.length > LIMIT && (
          <li className="px-3 py-2 text-center text-xs text-muted-foreground">{(options.length - LIMIT).toLocaleString()} more; keep typing to narrow them down.</li>
        )}
      </ul>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Typing goes on in the search box
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        on ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** A font, drawn in itself once it's scrolled into view */
function FontRow({
  index,
  option,
  active,
  selected,
  onHover,
  onPick,
}: {
  index: number;
  option: Option;
  active: boolean;
  selected: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [ready, setReady] = useState(option.font.source !== "fontsource");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const catalog = option.catalog;
    if (ready || !catalog || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      previewFont(catalog).then(
        () => setReady(true),
        () => setFailed(true),
      );
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [option.catalog, ready]);

  const family = cssFamily(option.font);
  return (
    <li
      ref={ref}
      id={`font-${index}`}
      data-index={index}
      role="option"
      aria-selected={selected}
      className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2", active && "bg-muted")}
      onMouseMove={onHover}
      onClick={onPick}
    >
      <div className={cn("min-w-0 flex-1 transition-opacity", !ready && !failed && "opacity-40")} style={ready ? { fontFamily: family } : undefined}>
        <div className="truncate text-[15px] leading-snug">{option.font.family}</div>
        <div className="truncate text-xs leading-snug text-muted-foreground">{failed ? "Preview unavailable" : SAMPLE}</div>
      </div>
      <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {option.font.source === "local" ? "Device" : option.font.source === "builtin" ? "Built in" : CATEGORY_LABEL[option.font.category]}
      </span>
      <CheckIcon className={cn("size-4 shrink-0 text-primary", !selected && "invisible")} />
    </li>
  );
}
