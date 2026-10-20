import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { loadBook, loadVerse } from "@/bible/library";
import { parseSelection, uniqueVerses } from "@/bible/topos";
import { sameVerse, verseKey, type SelectedPassage, type Translation, type VerseRef, type VerseText } from "@/bible/types";
import { pickNext } from "@/practice/queue";
import { useActiveSet, useApp, useTranslation } from "./store";

/** What's being practiced now; not saved between visits */
interface Session {
  current: VerseRef | null;
  /** Verses asked this round (shuffle order) */
  asked: Set<string>;
  /** A passage of the selection to practice alone, by its index */
  focus: number | null;
  /** Verses the translation doesn't have, passed over */
  missing: Set<string>;
  setCurrent: (v: VerseRef | null) => void;
  setFocus: (i: number | null) => void;
  markMissing: (v: VerseRef) => void;
}

export const useSession = create<Session>()((set) => ({
  current: null,
  asked: new Set(),
  focus: null,
  missing: new Set(),
  setCurrent: (current) => set({ current }),
  setFocus: (focus) => set({ focus, asked: new Set() }),
  markMissing: (v) => set((s) => ({ missing: new Set(s.missing).add(verseKey(v)) })),
}));

export interface Selection {
  passages: SelectedPassage[];
  /** Every verse selected, each once */
  verses: VerseRef[];
  /** The verses practiced: the focused passage's, or all of them, less those the translation lacks */
  pool: VerseRef[];
}

export function useSelection(): Selection {
  const { text } = useActiveSet();
  const focus = useSession((s) => s.focus);
  const missing = useSession((s) => s.missing);
  const passages = useMemo(() => parseSelection(text), [text]);
  return useMemo(() => {
    const verses = uniqueVerses(passages);
    const focused = focus !== null && passages[focus] ? passages[focus].verses : verses;
    const pool = focused.filter((v) => !missing.has(verseKey(v)));
    return { passages, verses, pool };
  }, [passages, focus, missing]);
}

/** Moves to the next verse by the chosen order */
export function advance(pool: VerseRef[]) {
  const { current } = useSession.getState();
  const { settings, stats } = useApp.getState();
  const asked = new Set(useSession.getState().asked);
  useSession.setState({ current: pickNext(pool, current, settings.order, asked, stats), asked });
}

/** Keeps the current verse inside the pool as the selection changes */
export function useKeepCurrent(pool: VerseRef[]) {
  const current = useSession((s) => s.current);
  const focus = useSession((s) => s.focus);
  useEffect(() => {
    if (pool.length === 0) {
      if (current) useSession.getState().setCurrent(null);
      return;
    }
    if (!current || !pool.some((v) => sameVerse(v, current))) advance(pool);
  }, [pool, current, focus]);
}

export type VerseState =
  | { status: "loading" }
  | { status: "ready"; verse: VerseText }
  | { status: "missing" }
  | { status: "error"; error: string };

/** A verse's text in a translation, downloading its book if needed */
export function useVerseText(translation: Translation, verse: VerseRef | null): [VerseState, retry: () => void] {
  const [state, setState] = useState<{ key: string; value: VerseState } | null>(null);
  const key = verse ? `${translation.id}/${verseKey(verse)}` : "";
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!verse) return;
    let live = true;
    loadVerse(translation, verse).then(
      (text) => live && setState({ key, value: text ? { status: "ready", verse: text } : { status: "missing" } }),
      (error: Error) => live && setState({ key, value: { status: "error", error: error.message } }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);
  useEffect(() => {
    // Retry failed downloads when the connection comes back
    const again = () => setRetry((n) => n + 1);
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, []);
  const value: VerseState = state && state.key === key ? state.value : { status: "loading" };
  return [value, () => {
    setState(null);
    setRetry((n) => n + 1);
  }];
}

/** Downloads the selection's books in the background, so moving between verses is instant */
export function usePrefetch(verses: VerseRef[]) {
  const translation = useTranslation();
  useEffect(() => {
    const books = [...new Set(verses.map((v) => v.bookId))].slice(0, 12);
    let i = 0;
    let cancelled = false;
    const next = () => {
      if (cancelled || i >= books.length) return;
      loadBook(translation, books[i++]!).catch(() => {}).finally(next);
    };
    const timer = setTimeout(next, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [translation, verses]);
}
