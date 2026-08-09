/// <reference types="vitest/config" />
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/health": "http://localhost:3000",
      "/tags": "http://localhost:3000",
      "/search": "http://localhost:3000",
      "/thumbnail": "http://localhost:3000",
      "/video": "http://localhost:3000",
    },
  },
  test: {
    environment: "jsdom",
  },
});
