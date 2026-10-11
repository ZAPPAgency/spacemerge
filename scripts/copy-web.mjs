// Copies www/ into dist-www/ unchanged: the game is plain <script> files that
// Vite cannot bundle. `vite build` then adds the bundled native-bridge.js.
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "www");
const dest = path.join(root, "dist-www");

// Paths relative to www/ that never ship in the native app.
const EXCLUDED = new Set([
  "js/debug.js", // debug panel
  "js/native-bridge.js", // replaced by the Vite bundle
  "social-share.png", // link-preview image for the web page only
  "icon-512.png", // web icon source, not used by the game
]);

await rm(dest, { recursive: true, force: true });
await cp(src, dest, {
  recursive: true,
  filter: (file) =>
    path.basename(file) !== ".DS_Store" &&
    !EXCLUDED.has(path.relative(src, file).split(path.sep).join("/")),
});
