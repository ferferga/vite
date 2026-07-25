import { defineConfig } from 'vite'

export default defineConfig({
  base: '/shared-chunks/',
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
  worker: {
    format: 'es',
    shareChunks: true,
    rolldownOptions: {
      output: {
        assetFileNames: 'assets/worker_asset-[name]-[hash].[ext]',
        chunkFileNames: 'assets/worker_chunk-[name]-[hash].js',
        entryFileNames: 'assets/worker_entry-[name].js',
      },
    },
  },
  build: {
    outDir: 'dist/shared-chunks',
    rolldownOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name].js',
        manualChunks(id) {
          if (id.includes('workerImport')) {
            return 'shared-worker-import-chunk'
          }
        },
      },
    },
  },
})
