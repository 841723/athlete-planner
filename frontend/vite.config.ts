import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // En docker-compose apunta a http://backend:4000; local, a localhost.
      "/api": process.env.VITE_PROXY_TARGET ?? "http://localhost:4000",
    },
  },
});