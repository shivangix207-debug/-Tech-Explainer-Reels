import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Uploaded videos/thumbnails are served by the backend at /uploads/...
      "/uploads": { target: process.env.VITE_BACKEND_URL || "http://localhost:5000", changeOrigin: true },
      "/api": {
        // Defaults to localhost for normal (non-Docker) development.
        // Docker Compose overrides this with VITE_BACKEND_URL=http://backend:5000
        target: process.env.VITE_BACKEND_URL || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
