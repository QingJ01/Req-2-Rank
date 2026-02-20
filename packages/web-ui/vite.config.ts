import { defineConfig } from "vite";

const apiTarget = process.env.R2R_WEB_UI_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
  server: {
    port: 4173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});
