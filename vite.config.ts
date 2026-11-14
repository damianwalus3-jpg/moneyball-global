import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Nitro auto-detects the production host (Vercel, Cloudflare, Netlify, etc.).
// Do not pin a Cloudflare preset: the public Moneyball deployment is on Vercel.
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
