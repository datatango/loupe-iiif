// vitePreprocess lets Svelte components use TypeScript in <script lang="ts">
// (and modern CSS), handing that work to the same esbuild step Vite already uses.
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
