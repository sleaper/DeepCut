import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'electron/main'),
        '@db': resolve(__dirname, 'electron/main/database'),
        '@utils': resolve(__dirname, 'electron/main/utils')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'electron/main'),
        '@db': resolve(__dirname, 'electron/main/database'),
        '@utils': resolve(__dirname, 'electron/main/utils')
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks(id): string | void {
            // Vendor chunk for node_modules
            if (id.includes('node_modules')) {
              // Separate large libraries into their own chunks
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor'
              }
              if (id.includes('@radix-ui')) {
                return 'radix-vendor'
              }
              if (id.includes('@trpc') || id.includes('@tanstack')) {
                return 'trpc-vendor'
              }
              if (id.includes('lucide-react')) {
                return 'icons-vendor'
              }
              return 'vendor'
            }
          }
        }
      },
      minify: 'esbuild',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      target: 'esnext'
    },
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
