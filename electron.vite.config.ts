import path from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = import.meta.dirname

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: path.resolve(root, 'electron/main/index.ts'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: path.resolve(root, 'electron/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(root, './src'),
      },
    },
    build: {
      rollupOptions: {
        input: path.resolve(root, 'index.html'),
      },
    },
  },
})
