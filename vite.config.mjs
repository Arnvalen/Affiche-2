import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'

const hasCert = fs.existsSync('.cert/cert.pem') && fs.existsSync('.cert/key.pem')

export default defineConfig({
  base: './',
  plugins: hasCert ? [react()] : [react(), basicSsl()],
  server: {
    host: true,
    port: 3000,
    open: true,
    https: hasCert
      ? { cert: fs.readFileSync('.cert/cert.pem'), key: fs.readFileSync('.cert/key.pem') }
      : true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
