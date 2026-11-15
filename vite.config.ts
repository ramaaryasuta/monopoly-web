import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173, open: false },
  build: { target: "es2022", chunkSizeWarningLimit: 6000 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as never);
