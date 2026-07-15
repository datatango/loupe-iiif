import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import webExtension from "vite-plugin-web-extension";

const target = process.env.TARGET ?? "chrome";

export default defineConfig({
  // separate output directories per target - Chrome and Firefox need different
  // background keys (service_worker vs scripts), so one build's dist/manifest.json
  // must never be left sitting around to be mistaken for the other's.
  build: {
    outDir: `dist-${target}`,
  },
  plugins: [
    svelte(),
    webExtension({
      manifest: "manifest.json",
      additionalInputs: ["workbench.html"],
      // resolves the {{chrome}}/{{firefox}} keys in manifest.json;
      // TARGET=firefox npm run build produces the Firefox build.
      browser: target,
    }),
  ],
});
