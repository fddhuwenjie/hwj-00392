import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3392,
    proxy: {
      '/api': {
        target: 'http://localhost:8392',
        changeOrigin: true
      }
    }
  }
});
