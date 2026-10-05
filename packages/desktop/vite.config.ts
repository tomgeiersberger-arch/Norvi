import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import ports from "../../__ports.cjs";

export default defineConfig({
  build: {
    rollupOptions: {
      input: path.join(import.meta.dirname, "setup/index.html"),
    },
  },
  plugins: [
    electron({
      main: {
        entry: "electron/main.ts",
      },
      preload: {
        input: path.join(import.meta.dirname, "electron/preload.ts"),
      },
    }),
  ],
  server: {
    port: ports.desktop,
    strictPort: true,
    allowedHosts: true,
  },
});