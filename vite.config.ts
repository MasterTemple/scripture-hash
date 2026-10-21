import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { Logoxide } from "logoxide";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * What the text logoxide reads from a file depends on (its parsed-book format and version),
 * which saved books record having been read by
 */
export const logoxideTextVersion = (): string => Logoxide.new().textVersion();

export default defineConfig({
  // Relative URLs, so the build works under any path (GitHub Pages serves it at /scripture-hash/)
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    // Installable, and working offline: the app is cached by a service worker, and the books
    // it downloads are kept in IndexedDB already
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Scripture Hash",
        short_name: "Scripture Hash",
        description: "Memorize Bible verses and where they are: name a verse's reference, or recite it word by word.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f7f5f1",
        theme_color: "#f7f5f1",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Every font subset and both WebAssembly modules (logoxide's is over 5 MB)
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          // Fonts chosen in settings, kept once used
          {
            urlPattern: ({ url }) => url.origin === "https://cdn.jsdelivr.net" && url.pathname.startsWith("/fontsource/"),
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 200 }, cacheableResponse: { statuses: [0, 200] } },
          },
          // The lists of fonts and of fetch.bible's translations, fresh when online
          {
            urlPattern: ({ url }) => url.href === "https://api.fontsource.org/v1/fonts" || url.href === "https://v1.fetch.bible/manifest.json",
            handler: "NetworkFirst",
            options: { cacheName: "lists", networkTimeoutSeconds: 5, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  define: { __LOGOXIDE_TEXT_VERSION__: JSON.stringify(logoxideTextVersion()) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Both packages fetch their .wasm next to themselves (`new URL(…, import.meta.url)`),
  // which pre-bundling would break
  optimizeDeps: { exclude: ["logoxide", "topos-bible"] },
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 800 },
  server: { host: true },
});
