import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3456',
      '/socket.io': {
        target: 'http://localhost:3456',
        ws: true,
      },
    },
  },
});
