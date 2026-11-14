import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Build the production server bundle for Cloudflare Workers via Nitro.
export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    nitro({
      preset: "cloudflare_module",
      cloudflare: {
        wrangler: {
          name: "moneyball-global",
          compatibility_date: "2026-11-14",
          observability: { enabled: true },
        },
      },
    }),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
