import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/store";
import { AskParts, AutoAdvanceRow, FontRow, OrderRow, PunctuationRow, ReciteStyleRow, WholeWordRows } from "./controls";

/**
 * The current tab's settings, under the practice area on wider screens, so they can be
 * changed while practicing (phones keep them in the settings dialog)
 */
export function TabSettings() {
  const mode = useApp((s) => s.mode);
  const open = useApp((s) => s.settings.tabSettingsOpen);
  const update = useApp((s) => s.updateSettings);
  if (mode === "read") return null;

  let body: ReactNode;
  if (mode === "reference") {
    body = (
      <>
        <div className="md:col-span-2">
          <AskParts />
        </div>
        <OrderRow />
        <AutoAdvanceRow />
      </>
    );
  } else {
    body = (
      <>
        <ReciteStyleRow />
        <FontRow preview={false} />
        <PunctuationRow />
        <WholeWordRows />
        <OrderRow />
        <AutoAdvanceRow />
      </>
    );
  }

  return (
    <section className="hidden rounded-2xl border bg-card/60 md:block">
      <button
        className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => update({ tabSettingsOpen: !open })}
        aria-expanded={open}
      >
        <SlidersHorizontalIcon className="size-4" />
        {mode === "reference" ? "Reference settings" : "Recite settings"}
        <ChevronDownIcon className={cn("ml-auto size-4 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="grid gap-x-8 border-t px-5 pb-2 md:grid-cols-2 [&>*]:border-b [&>*:nth-last-child(-n+2)]:border-b-0">
          {body}
        </div>
      )}
    </section>
  );
}
