import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    root: './',
    resolve: {
        alias: {
            '/src': path.resolve(__dirname, '../src'),
        },
    },
    server: {
        fs: {
            allow: ['..']
        },
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            }
        }
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // Three.js is ~500 kB on its own and is only reached through the
                // lazy-loaded Divine Spire. Splitting it into its own chunk means the
                // Spire's application code can change without invalidating the cached
                // copy of the library, and vice versa.
                manualChunks: {
                    three: ['three'],
                    motion: ['motion/react']
                }
            }
        }
    },
    publicDir: './public',
})
