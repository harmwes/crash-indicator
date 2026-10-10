import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development stuurt Vite /api door naar de FastAPI-gateway op poort 8000.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
})
