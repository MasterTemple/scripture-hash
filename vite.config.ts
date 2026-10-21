import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/** The logoxide installed, which saved books record having been read by */
export const logoxideVersion = (): string =>
  JSON.parse(readFileSync(new URL("./node_modules/logoxide/package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  // Relative URLs, so the build works under any path (GitHub Pages serves it at /scripture-hash/)
  base: "./",
  plugins: [react(), tailwindcss()],
  define: { __LOGOXIDE_VERSION__: JSON.stringify(logoxideVersion()) },
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
