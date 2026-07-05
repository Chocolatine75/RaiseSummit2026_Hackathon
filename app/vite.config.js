import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the React app straight into the Keeper's served /public dir so one
// `wrangler deploy` ships everything. Keeps sw.js / staged / models untouched.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "../public",
    emptyOutDir: false, // preserve sw.js, staged/, models/, manifest, icon
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: { port: 5180 },
});
