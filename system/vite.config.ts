import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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
        // The one chunk over Vite's 500 kB default is Three.js (~511 kB, ~130 kB gzipped), and
        // it is never on the first-load path: the dashboard's dais imports it dynamically once
        // the browser is idle, and the Divine Spire is itself lazy. The limit sits just above
        // it, so the warning still fires if anything else grows that large.
        chunkSizeWarningLimit: 540,
        rollupOptions: {
            output: {
                // Libraries in chunks of their own, so a deploy that changes only app code
                // leaves them cached. Three.js is reached only through lazy code (above).
                // React is needed at once, but changes far less often than the app does.
                manualChunks: {
                    three: ['three'],
                    motion: ['motion/react'],
                    react: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']
                }
            }
        }
    },
})
