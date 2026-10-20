import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { BUILT_IN, DEFAULT_TRANSLATION } from "@/bible/translations";
import type { Translation, VerseRef } from "@/bible/types";
import { DEFAULT_FONT, type FontChoice } from "@/lib/fonts";
import { verseKey } from "@/bible/types";

export type Mode = "reference" | "recite" | "read";
export type Order = "shuffle" | "sequential" | "weakest";
export type ReciteStyle = "letters" | "words";
export type Theme = "system" | "light" | "dark";

export interface VerseSet {
  id: string;
  name: string;
  text: string;
}

export interface Settings {
  /** Which parts of the reference to ask for when naming one */
  ask: { book: boolean; chapter: boolean; verse: boolean };
  order: Order;
  /** Reciting: type each word's first letter, or the words themselves */
  reciteStyle: ReciteStyle;
  /** Reciting: show each hidden word's first letter faintly */
  firstLetterHints: boolean;
  /** Reciting whole words: mark a wrong letter as it's typed, not once the word is done */
  liveTypos: boolean;
  /** Reciting: show hidden words' punctuation, so a blank's width is all letters */
  showPunctuation: boolean;
  /** Go to the next verse on its own after a correct answer */
  autoAdvance: boolean;
  /** Whether the current tab's settings under the practice area are expanded (wider screens) */
  tabSettingsOpen: boolean;
  /** The font the verse is typed in */
  reciteFont: FontChoice;
  theme: Theme;
}

export interface Attempt {
  id: string;
  at: number;
  mode: "reference" | "recite";
  verse: VerseRef;
  translation: string;
  correct: boolean;
  /** 0 to 1: the share of the reference's parts, or of the verse's words, gotten right */
  score: number;
  /** What was answered, as written for the history */
  answer?: string;
}

export interface VerseStat {
  attempts: number;
  correct: number;
  /** Correct answers in a row */
  streak: number;
  last: number;
}

interface State {
  sets: VerseSet[];
  activeSetId: string;
  translationId: string;
  /** Translations added from fetch.bible's list or uploaded */
  translations: Translation[];
  mode: Mode;
  settings: Settings;
  history: Attempt[];
  stats: Record<string, VerseStat>;

  setMode: (mode: Mode) => void;
  setTranslation: (id: string) => void;
  addTranslation: (t: Translation) => void;
  removeTranslation: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addSet: (name?: string, text?: string) => string;
  updateSet: (id: string, patch: Partial<Omit<VerseSet, "id">>) => void;
  removeSet: (id: string) => void;
  setActiveSet: (id: string) => void;
  record: (attempt: Omit<Attempt, "id" | "at">) => void;
  clearHistory: () => void;
  resetProgress: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const STARTER: VerseSet[] = [
  { id: "starter", name: "Getting started", text: "John 3:16\nRomans 8:28-39\nPhilippians 4:6-7\nPsalm 23" },
];

export const MAX_HISTORY = 1000;

/**
 * localStorage, written a moment after the last change rather than on every one: the state
 * holds the whole history, and serializing it on each keystroke or toggle made the page lag.
 * Pending writes are flushed when the page is hidden or closed.
 */
function lazyStorage<S>(delay = 400): PersistStorage<S> {
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    try {
      localStorage.setItem(pending.name, JSON.stringify(pending.value));
    } catch {
      // Full or blocked storage: keep going without saving
    }
    pending = null;
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    removeItem: (name) => {
      pending = null;
      localStorage.removeItem(name);
    },
  };
}

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      sets: STARTER,
      activeSetId: STARTER[0]!.id,
      translationId: DEFAULT_TRANSLATION,
      translations: [],
      mode: "reference",
      settings: {
        ask: { book: true, chapter: true, verse: true },
        order: "shuffle",
        reciteStyle: "letters",
        firstLetterHints: false,
        liveTypos: false,
        showPunctuation: true,
        autoAdvance: true,
        reciteFont: DEFAULT_FONT,
        tabSettingsOpen: true,
        theme: "system",
      },
      history: [],
      stats: {},

      setMode: (mode) => set({ mode }),
      setTranslation: (translationId) => set({ translationId }),
      addTranslation: (t) =>
        set((s) => ({ translations: [...s.translations.filter((x) => x.id !== t.id), t] })),
      removeTranslation: (id) =>
        set((s) => ({
          translations: s.translations.filter((t) => t.id !== id),
          translationId: s.translationId === id ? DEFAULT_TRANSLATION : s.translationId,
        })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      addSet: (name = "New set", text = "") => {
        const id = uid();
        set((s) => ({ sets: [...s.sets, { id, name, text }], activeSetId: id }));
        return id;
      },
      updateSet: (id, patch) => set((s) => ({ sets: s.sets.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeSet: (id) =>
        set((s) => {
          const sets = s.sets.filter((x) => x.id !== id);
          if (sets.length === 0) sets.push({ id: uid(), name: "My verses", text: "" });
          return { sets, activeSetId: s.activeSetId === id ? sets[0]!.id : s.activeSetId };
        }),
      setActiveSet: (activeSetId) => set({ activeSetId }),
      record: (attempt) => {
        const key = verseKey(attempt.verse);
        const prev = get().stats[key] ?? { attempts: 0, correct: 0, streak: 0, last: 0 };
        const at = Date.now();
        set((s) => ({
          history: [{ ...attempt, id: uid(), at }, ...s.history].slice(0, MAX_HISTORY),
          stats: {
            ...s.stats,
            [key]: {
              attempts: prev.attempts + 1,
              correct: prev.correct + (attempt.correct ? 1 : 0),
              streak: attempt.correct ? prev.streak + 1 : 0,
              last: at,
            },
          },
        }));
      },
      clearHistory: () => set({ history: [] }),
      resetProgress: () => set({ history: [], stats: {} }),
    }),
    {
      name: "scripture-hash",
      version: 1,
      storage: lazyStorage(),
      // Settings added since a visit keep their defaults
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<State>;
        return { ...current, ...s, settings: { ...current.settings, ...s.settings } };
      },
    },
  ),
);

export const useTranslation = (): Translation => {
  const id = useApp((s) => s.translationId);
  const added = useApp((s) => s.translations);
  return BUILT_IN.find((t) => t.id === id) ?? added.find((t) => t.id === id) ?? BUILT_IN[0]!;
};

export const useActiveSet = (): VerseSet => {
  const sets = useApp((s) => s.sets);
  const id = useApp((s) => s.activeSetId);
  return sets.find((x) => x.id === id) ?? sets[0]!;
};
