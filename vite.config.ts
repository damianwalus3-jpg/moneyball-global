import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/openligadb": {
        target: "https://api.openligadb.de",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/openligadb\/leagues\//, "/getavailableleagues/").replace(/^\/api\/openligadb\/matches\//, "/getmatchdata/"),
      },
    },
  },
});
