import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        cricket: resolve(__dirname, "cricket.html"),
        frog: resolve(__dirname, "frog.html"),
        smoke: resolve(__dirname, "smoke.html"),
      },
    },
  },
});
