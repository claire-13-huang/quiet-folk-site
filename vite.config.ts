import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ base: '/quiet-folk-site/', plugins: [react()], optimizeDeps: { entries: ['index.html'] } })
