import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

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
  server: { 
    port: 5180,
    proxy: {
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
      },
      "/event": "http://localhost:8787",
      "/api": "http://localhost:8787",
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith("/models/")) {
          const filePath = path.resolve("../models", req.url.slice(8));
          if (fs.existsSync(filePath)) {
            res.setHeader("Content-Type", "application/octet-stream");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    }
  },
});
