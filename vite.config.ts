import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { Logoxide } from "logoxide";
import { defineConfig } from "vite";

/**
 * What the text logoxide reads from a file depends on (its parsed-book format and version),
 * which saved books record having been read by
 */
export const logoxideTextVersion = (): string => Logoxide.new().textVersion();

export default defineConfig({
  // Relative URLs, so the build works under any path (GitHub Pages serves it at /scripture-hash/)
  base: "./",
  plugins: [react(), tailwindcss()],
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
