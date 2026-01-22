// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills' // <-- Import this
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // To enable your custom global objects, specify them here.
      globals: {
        Buffer: true,
        process: true,
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
    tailwindcss()
  ],
  optimizeDeps: {
    // Vite's dependency pre-bundling during dev mode.
    // If some deps use Node.js built-ins and are causing issues in dev,
    // you can explicitly exclude them from pre-bundling so Rollup/ESBuild processes them more deeply.
    // This is often where polyfills get picked up.
    exclude: [
      // Add modules that rely on Node.js built-ins here
      'buffer',
    ],
  }
})