import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    svelte(),
    webExtension({
      manifest: "manifest.json",
      additionalInputs: ["workbench.html"],
      // resolves the {{chrome}}/{{firefox}} keys in manifest.json;
      // TARGET=firefox npm run build produces the Firefox build.
      browser: process.env.TARGET ?? "chrome",
    }),
  ],
});
