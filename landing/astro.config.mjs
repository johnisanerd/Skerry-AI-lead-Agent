import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://skerry.cloud",
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    // Skip the workerd dev runtime on macOS < 13.5. We only use standard env
    // vars (no Cloudflare bindings — no KV, R2, D1), so disabling the
    // platform proxy in dev is safe. Production on Cloudflare Pages still
    // injects bindings at request-time as normal.
    platformProxy: { enabled: false },
  }),
  integrations: [tailwind({ applyBaseStyles: false }), react()],
  prefetch: { defaultStrategy: "viewport" },
  vite: {
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
    },
  },
});
