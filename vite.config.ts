import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs, so the build works under any path (GitHub Pages serves it at /ScriptureHash/)
  base: "./",
  plugins: [react(), tailwindcss()],
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
