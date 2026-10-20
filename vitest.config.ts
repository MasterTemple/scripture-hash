import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { logoxideVersion } from "./vite.config";

export default defineConfig({
  define: { __LOGOXIDE_VERSION__: JSON.stringify(logoxideVersion()) },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
