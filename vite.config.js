import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      "/seoul-api": {
        target: "http://openapi.seoul.go.kr:8088",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/seoul-api/, ""),
      },
      "/kakao-api": {
        target: "https://dapi.kakao.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kakao-api/, ""),
      },
    },
  },
});
