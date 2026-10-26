import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { devApi } from "./server/dev-api";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "PIN_BOAZ_HASH",
    "PIN_MISHEL_HASH",
    "PUSH_VAPID_PUBLIC_KEY",
    "PUSH_VAPID_PRIVATE_KEY",
  ]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [devApi(), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
    },
    build: {
      // The initial bundle mixes React, Firebase and app code into one
      // monolithic chunk, so it has to finish downloading before anything
      // can render. Splitting vendor code into its own cacheable chunks lets
      // the browser fetch them in parallel and reuse them across deploys
      // (app code changes far more often than these dependencies do).
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            // firebase/storage is dynamically imported on first use (vault
            // media, chat attachments) precisely so it's NOT in the boot
            // path; keep it out of the eagerly-loaded vendor-firebase chunk
            // or it would be dragged back into the initial bundle.
            if (/[\\/](@firebase[\\/]storage|firebase[\\/]storage)[\\/]/.test(id))
              return "vendor-firebase-storage";
            if (/firebase|@firebase/.test(id)) return "vendor-firebase";
            if (/\/react(-dom)?\//.test(id) || /\/scheduler\//.test(id))
              return "vendor-react";
            if (/lucide-react/.test(id)) return "vendor-icons";
            return "vendor";
          },
        },
      },
    },
  };
});
