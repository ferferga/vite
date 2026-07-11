import { defineConfig } from 'vite'
export default defineConfig({
  build: { outDir: 'dist', minify: false },
  worker: { format: 'es', shareChunks: true }
})
