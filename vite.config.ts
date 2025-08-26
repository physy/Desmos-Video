import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Desmos-Video/", // GitHubリポジトリ名に合わせて変更
  plugins: [react()],
});
