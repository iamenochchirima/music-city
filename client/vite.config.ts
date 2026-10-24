import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env: Record<string, string> = {
    ...loadEnv(mode, process.cwd(), ["VITE_", "NEXT_PUBLIC_"]),
    NODE_ENV: mode === "production" ? "production" : "development",
  };

  return {
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: "next/font/google",
          replacement: path.resolve(__dirname, "src/compat/next-font-google.ts"),
        },
        {
          find: "next/navigation",
          replacement: path.resolve(__dirname, "src/compat/next-navigation.ts"),
        },
        {
          find: "next/link",
          replacement: path.resolve(__dirname, "src/compat/next-link.tsx"),
        },
        {
          find: "next/image",
          replacement: path.resolve(__dirname, "src/compat/next-image.tsx"),
        },
        {
          find: "next",
          replacement: path.resolve(__dirname, "src/compat/next.ts"),
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "src"),
        },
      ],
    },
    define: {
      "process.env": JSON.stringify(env),
    },
    server: {
      port: 4317,
      proxy: {
        "/media/images": {
          target: new URL(process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || "http://localhost:4319/api/v1").origin,
          changeOrigin: true,
          rewrite: (url) => url.replace(/^\/media\/images/, "/api/v1/images"),
        },
      },
      allowedHosts: [".ngrok-free.app"],
    },
    preview: {
      port: 4317,
    },
  };
});
