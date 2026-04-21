import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Default base is '/Priest_bot/' for GitHub Pages; override via VITE_BASE in
// .env.local (or the shell) for local dev where you want to serve at '/'.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = env.VITE_BASE ?? "/Priest_bot/";
  return {
    plugins: [react()],
    base,
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: [],
    },
  };
});
