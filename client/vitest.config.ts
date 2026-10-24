import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname,"src"), "next/image": path.resolve(__dirname,"src/compat/next-image.tsx"), "next/link": path.resolve(__dirname,"src/compat/next-link.tsx"), "next/navigation": path.resolve(__dirname,"src/compat/next-navigation.ts") } },
  test: { environment: "jsdom",setupFiles: ["./src/test/setup.ts"],include: ["src/**/*.test.ts","src/**/*.test.tsx"] },
});
