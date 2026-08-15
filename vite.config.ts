import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base so the build works on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) as well as any other static host.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
