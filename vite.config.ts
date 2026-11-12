import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Direct Vite/TanStack/Nitro configuration; no hosted app-builder plugin.
// Keep Cloudflare's production preset out of dev mode to preserve local Vite development.
export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    nitro(process.env.NODE_ENV === "production" ? { preset: "cloudflare_module" } : {}),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
