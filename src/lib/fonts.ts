import { createStore, get, set } from "idb-keyval";

export type FontCategory = "serif" | "sans-serif" | "monospace" | "handwriting" | "display" | "other";

/** A font to set the verse in */
export interface FontChoice {
  /** Built in (bundled or the system's), from Fontsource's catalog, or installed on this device */
  source: "builtin" | "fontsource" | "local";
  family: string;
  /** Fontsource's id, for downloading it */
  id?: string;
  category: FontCategory;
  /** The CSS family for built-in fonts, when it isn't just `family` */
  css?: string;
}

export const BUILT_IN_FONTS: FontChoice[] = [
  { source: "builtin", family: "Literata", css: '"Literata Variable"', category: "serif" },
  { source: "builtin", family: "Inter", css: '"Inter Variable"', category: "sans-serif" },
  { source: "builtin", family: "JetBrains Mono", css: '"JetBrains Mono Variable"', category: "monospace" },
  { source: "builtin", family: "System serif", css: "ui-serif, Georgia, serif", category: "serif" },
  { source: "builtin", family: "System sans-serif", css: "system-ui, sans-serif", category: "sans-serif" },
  { source: "builtin", family: "System monospace", css: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", category: "monospace" },
];

export const DEFAULT_FONT = BUILT_IN_FONTS[0]!;

const FALLBACK: Record<FontCategory, string> = {
  serif: "ui-serif, Georgia, serif",
  "sans-serif": "system-ui, sans-serif",
  monospace: "ui-monospace, monospace",
  handwriting: "cursive",
  display: "system-ui, sans-serif",
  other: "system-ui, sans-serif",
};

/** The CSS `font-family` for a choice, with a fallback of its kind */
export const cssFamily = (f: FontChoice) => f.css ?? `"${f.family.replace(/"/g, "")}", ${FALLBACK[f.category]}`;

export const sameFont = (a: FontChoice, b: FontChoice) => a.source === b.source && a.family === b.family;

/** One of Fontsource's fonts */
export interface CatalogFont {
  id: string;
  family: string;
  category: FontCategory;
  subsets: string[];
  defSubset: string;
  weights: number[];
  styles: string[];
}

const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";
const db = createStore("scripture-hash-fonts", "fonts");
const WEEK = 7 * 24 * 3600 * 1000;

let catalog: Promise<CatalogFont[]> | null = null;

/** Fontsource's ~2,000 fonts, kept a week so the picker opens quickly */
export function loadFontCatalog(): Promise<CatalogFont[]> {
  catalog ??= (async () => {
    const saved = await get<{ at: number; fonts: CatalogFont[] }>("catalog", db).catch(() => undefined);
    if (saved && Date.now() - saved.at < WEEK) return saved.fonts;
    try {
      const response = await fetch("https://api.fontsource.org/v1/fonts");
      if (!response.ok) throw new Error(`Couldn't load the font list (${response.status})`);
      const all = (await response.json()) as (Omit<CatalogFont, "category"> & { category: string })[];
      const fonts = all
        .filter((f) => f.category !== "icons" && f.weights.length > 0)
        .map(({ id, family, category, subsets, defSubset, weights, styles }) => ({
          id,
          family,
          category: (["serif", "sans-serif", "monospace", "handwriting", "display"].includes(category) ? category : "other") as FontCategory,
          subsets,
          defSubset,
          weights,
          styles,
        }));
      await set("catalog", { at: Date.now(), fonts }, db).catch(() => {});
      return fonts;
    } catch (error) {
      if (saved) return saved.fonts; // stale beats nothing, offline
      throw error;
    }
  })();
  catalog.catch(() => (catalog = null));
  return catalog;
}

/** The file of a font's regular weight in its main script */
function fileUrl(f: Pick<CatalogFont, "id" | "defSubset" | "weights" | "styles">) {
  const weight = f.weights.includes(400) ? 400 : f.weights.reduce((a, b) => (Math.abs(b - 400) < Math.abs(a - 400) ? b : a));
  const style = f.styles.includes("normal") ? "normal" : f.styles[0] ?? "normal";
  return `${CDN}/${f.id}@latest/${f.defSubset}-${weight}-${style}.woff2`;
}

const loaded = new Map<string, Promise<void>>();

async function addFace(family: string, source: ArrayBuffer | string) {
  const face = new FontFace(family, typeof source === "string" ? `url(${source})` : source);
  await face.load();
  document.fonts.add(face);
}

/** Loads a catalog font to preview it (the browser caches the file) */
export function previewFont(f: CatalogFont): Promise<void> {
  const key = `preview:${f.family}`;
  let p = loaded.get(key);
  if (!p) {
    p = addFace(f.family, fileUrl(f));
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return p;
}

/**
 * Makes a chosen font usable: a catalog font is saved on this device the first time, so it
 * works offline afterwards. Built-in and installed fonts need nothing.
 */
export function loadFont(f: FontChoice, catalogFont?: CatalogFont): Promise<void> {
  if (f.source !== "fontsource" || !f.id) return Promise.resolve();
  const loadedKey = `chosen:${f.family}`;
  let p = loaded.get(loadedKey);
  if (!p) {
    p = (async () => {
      const key = `file:${f.id}`;
      let bytes = await get<ArrayBuffer>(key, db).catch(() => undefined);
      if (!bytes) {
        const meta = catalogFont ?? (await loadFontCatalog()).find((c) => c.id === f.id);
        if (!meta) throw new Error(`No font “${f.family}”`);
        const response = await fetch(fileUrl(meta));
        if (!response.ok) throw new Error(`Couldn't download ${f.family} (${response.status})`);
        bytes = await response.arrayBuffer();
        await set(key, bytes, db).catch(() => {});
      }
      await addFace(f.family, bytes);
    })();
    p.catch(() => loaded.delete(loadedKey));
    loaded.set(loadedKey, p);
  }
  return p;
}

/** Whether this browser can list the fonts installed on the device (Chrome and Edge on desktop) */
export const canListDeviceFonts = () => typeof window !== "undefined" && "queryLocalFonts" in window;

/** The device's font families; asks permission the first time, so call it from a click */
export async function listDeviceFonts(): Promise<FontChoice[]> {
  const query = (window as unknown as { queryLocalFonts: () => Promise<{ family: string }[]> }).queryLocalFonts;
  const fonts = await query();
  const families = [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  return families.map((family) => ({
    source: "local",
    family,
    category: /mono|code|courier|consol|terminal|fixed|typewriter/i.test(family) ? "monospace" : /serif/i.test(family) && !/sans/i.test(family) ? "serif" : "sans-serif",
  }));
}
