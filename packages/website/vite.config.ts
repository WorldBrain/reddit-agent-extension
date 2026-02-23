import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";

const envDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const commonSource = resolve(projectRoot, "../common/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "reddit-agent-common": commonSource,
    },
  },
  envDir,
  build: {
    outDir: "build",
  },
  server: {
    host: "localhost",
    port: 7259,
    strictPort: true,
  },
});
