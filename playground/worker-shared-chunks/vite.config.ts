import { defineConfig } from 'vite'

export default defineConfig({
  worker: {
    format: 'es',
  },
  build: {
    minify: false,
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('shared.js')) {
            return 'shared'
          }
        },
      },
    },
  },
})
