import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('@react-three') || id.includes('/three/')) {
            return 'three-vendor';
          }

          if (id.includes('lightweight-charts')) {
            return 'charts-vendor';
          }

          if (id.includes('/gsap/')) {
            return 'motion-vendor';
          }

          if (id.includes('/web3/')) {
            return 'web3-vendor';
          }

          if (id.includes('/react-dom/') || id.includes('/react/')) {
            return 'react-vendor';
          }

          if (id.includes('/lucide-react/')) {
            return 'icons-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
