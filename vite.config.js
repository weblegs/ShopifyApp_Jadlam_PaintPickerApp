import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fsp from "fs/promises";

// Windows fix: React Router creates "+types" directories that Windows locks
// and can never be deleted, causing EPERM on every subsequent shopify app dev run.
// This plugin intercepts fs.promises.mkdir and writeFile to silently skip
// any path that contains "+types" so the directory is never created.
const preventPlusTypesDirPlugin = () => ({
  name: "prevent-plus-types-win32",
  enforce: "pre",
  configResolved() {
    if (process.platform !== "win32") return;
    const origMkdir = fsp.mkdir.bind(fsp);
    const origWriteFile = fsp.writeFile.bind(fsp);
    fsp.mkdir = (path, options) => {
      if (String(path).includes("+types")) return Promise.resolve();
      return origMkdir(path, options);
    };
    fsp.writeFile = (path, data, options) => {
      if (String(path).includes("+types")) return Promise.resolve();
      return origWriteFile(path, data, options);
    };
  },
});

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;
let hmrConfig;

if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [preventPlusTypesDirPlugin(), reactRouter({ typesafeRoutes: false }), tsconfigPaths()],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
});
