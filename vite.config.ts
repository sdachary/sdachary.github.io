import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        manacitra: resolve(__dirname, 'manacitra.html'),
        floweditor: resolve(__dirname, 'floweditor.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) return 'vendor'
          if (id.includes('node_modules/react')) return 'vendor'
          if (id.includes('node_modules/framer-motion')) return 'motion'
          if (id.includes('node_modules/@xyflow')) return 'xyflow'
        },
      },
    },
  },
})