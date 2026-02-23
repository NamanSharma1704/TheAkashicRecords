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
        }
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    publicDir: './public',
})
