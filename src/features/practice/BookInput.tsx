import { forwardRef, useState, type KeyboardEvent } from "react";
import { suggestBooks } from "@/bible/topos";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** A book's name, with suggestions as it's typed; Tab or Enter on a suggestion takes it */
export const BookInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    onAccept: () => void;
    onEnter: () => void;
    /** Answered: it keeps the focus (and a phone's keyboard), but suggests nothing */
    locked?: boolean;
    /** Suggestions open above, for a field at the bottom of the screen */
    above?: boolean;
    className?: string;
  }
>(function BookInput({ value, onChange, onAccept, onEnter, locked, above, className }, ref) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = open && !locked ? suggestBooks(value) : [];
  const exact = suggestions.length > 0 && suggestions[0]!.name.toLowerCase() === value.trim().toLowerCase();
  const showList = suggestions.length > 0 && !exact;

  const take = (name: string) => {
    onChange(name);
    setOpen(false);
    onAccept();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
    } else if (showList && (e.key === "Tab" || e.key === "Enter") && !e.shiftKey) {
      e.preventDefault();
      take(suggestions[active]!.name);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={ref}
        value={value}
        aria-readonly={locked}
        placeholder="Book"
        aria-label="Book"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        role="combobox"
        aria-expanded={showList}
        className="h-12 text-lg font-medium"
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul role="listbox" className={cn("absolute right-0 left-0 z-30 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg animate-fade-up", above ? "bottom-full mb-1.5" : "top-full mt-1.5")}>
          {suggestions.map((book, i) => (
            <li
              key={book.id}
              role="option"
              aria-selected={i === active}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm",
                i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                take(book.name);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="font-medium">{book.name}</span>
              <span className="text-xs text-muted-foreground">{book.abbreviation}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
