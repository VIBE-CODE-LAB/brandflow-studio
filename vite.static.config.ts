import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/brandflow-studio/",
  resolve: {
    alias: {
      "@/lib/studioAuth": resolve("src/lib/staticStudioAuth.ts"),
    },
  },
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: ".pages-root",
    emptyOutDir: true,
    rollupOptions: {
      input: "static-index.html",
    },
  },
});
