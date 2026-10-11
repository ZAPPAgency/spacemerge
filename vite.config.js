import { defineConfig } from "vite";

// `npx vite` serves www/ for local web dev. `vite build` only bundles
// native-bridge.js (the one ES module, it imports the Capacitor plugins) into
// dist-www/js/. scripts/copy-web.mjs copies the rest of www/ before it, so
// `npm run build` must run both.
export default defineConfig({
  root: "www",
  base: "",
  publicDir: false,
  build: {
    outDir: "../dist-www/js",
    emptyOutDir: false, // keeps the files copied by scripts/copy-web.mjs
    lib: {
      entry: "js/native-bridge.js",
      formats: ["es"],
      fileName: () => "native-bridge.js",
    },
    // .js, not Vite's default .mjs: the native WebViews pick the MIME type from the extension.
    rolldownOptions: {
      output: { chunkFileNames: "[name]-[hash].js" },
    },
  },
});
